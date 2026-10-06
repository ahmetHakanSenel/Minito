import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { localDateKey } from '../lib/time/calendar';
import { useAuth } from '../features/auth/controller/AuthContext';
import {
  createProject,
  deleteProject as deleteProjectRecord,
  EMPTY_PLANNER_STATE,
  selectProjects,
  setTaskCompleted,
  type PlannerProject,
  type PlannerState,
  type PlannerTask,
} from '../features/planner/model';
import { plannerRemote } from '../features/planner/plannerRemote';
import {
  createPlannerPersister,
  loadPlannerState,
  retireLegacyProjects,
} from '../features/planner/plannerStorage';
import { PlannerSyncController } from '../features/planner/syncController';
import i18n from '../lib/i18n/config';
import { haptics } from '../lib/ui/haptics';

/**
 * The planner: projects and their next actions, per account, synced across devices.
 *
 * Screens always read local state, so the planner works offline and never shows a spinner.
 * Every edit is saved to disk first and pushed in the background (see features/planner).
 */

export type Task = PlannerTask;
export type Project = PlannerProject;

export type NewProjectInput = {
  title: string;
  color: string;
  dueDate?: Date;
  taskTitles: string[];
};

interface ProjectContextValue {
  projects: Project[];
  addProject: (project: NewProjectInput) => boolean;
  deleteProject: (projectId: string) => void;
  toggleTask: (projectId: string, taskId: string) => void;
  completeTaskById: (projectId: string, taskId: string) => void;
  getNextStep: (project: Project) => Task | null;
  generateSubtasks: (projectTitle: string) => Promise<string[]>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

// Local edits are batched briefly, so ticking three tasks in a row is one round trip.
const EDIT_SYNC_DELAY_MS = 800;

const newId = () => Crypto.randomUUID();
const nowIso = () => new Date().toISOString();

// ─── Sample subtask suggestions ─────────────────────────────────────────────────────────────────
// Keyword-matched sample steps; the planner labels them as a demo, never as AI output.

type SampleKey = 'thesis' | 'fitness' | 'language';

// Title keywords in every supported language; the suggestion text itself lives in the locale files.
const SAMPLE_KEYWORDS: [SampleKey, string[]][] = [
  ['thesis', ['tez', 'thesis']],
  ['fitness', ['fitness', 'spor', 'gym', 'workout']],
  ['language', ['dil', 'language']],
];

function sampleSuggestions(key: SampleKey | 'default'): string[] {
  const suggestions = i18n.t(`planner.samples.${key}`, { returnObjects: true });
  return Array.isArray(suggestions)
    ? suggestions.filter((item): item is string => typeof item === 'string')
    : [];
}

async function generateSampleSubtasks(projectTitle: string): Promise<string[]> {
  // A short pause lets the suggestion list animate in instead of popping.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const lowerTitle = projectTitle.toLowerCase();
  const match = SAMPLE_KEYWORDS.find(([, keywords]) =>
    keywords.some((keyword) => lowerTitle.includes(keyword))
  );
  return sampleSuggestions(match ? match[0] : 'default');
}

// ─── Provider ───────────────────────────────────────────────────────────────────────────────────

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [state, setState] = useState<PlannerState>(EMPTY_PLANNER_STATE);
  const stateRef = useRef<PlannerState>(EMPTY_PLANNER_STATE);
  const saveRef = useRef<((next: PlannerState) => Promise<void>) | null>(null);
  const syncRef = useRef<PlannerSyncController | null>(null);
  // Edits made before the saved state has loaded, replayed on top of it once it has.
  const earlyChangesRef = useRef<((current: PlannerState) => PlannerState)[] | null>(null);

  /** The one way state changes: memory, screen and disk, in that order. */
  const apply = useCallback((change: (current: PlannerState) => PlannerState) => {
    earlyChangesRef.current?.push(change);
    const next = change(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    void saveRef.current?.(next);
  }, []);

  useEffect(() => {
    stateRef.current = EMPTY_PLANNER_STATE;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the planner empties while the next account loads its own state
    setState(EMPTY_PLANNER_STATE);
    saveRef.current = null;
    earlyChangesRef.current = null;
    if (!userId) return;
    earlyChangesRef.current = [];

    let active = true;
    const persister = createPlannerPersister(userId);
    loadPlannerState(userId, newId)
      .then(async ({ state: loaded, hadLegacy }) => {
        if (!active) return;
        const early = earlyChangesRef.current ?? [];
        earlyChangesRef.current = null;
        const ready = early.reduce((current, change) => change(current), loaded);
        stateRef.current = ready;
        setState(ready);
        saveRef.current = persister.save;
        if (hadLegacy || early.length > 0) {
          // The old file goes only once its projects are safely in the new one.
          await persister.save(ready);
          if (hadLegacy) await retireLegacyProjects();
        }
        if (!active) return;
        const controller = new PlannerSyncController(
          { get: () => stateRef.current, update: apply },
          plannerRemote
        );
        syncRef.current = controller;
        controller.request(0);
      })
      .catch((error) => console.warn('Failed to load the planner:', error));

    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') syncRef.current?.request(0);
    });

    return () => {
      active = false;
      subscription.remove();
      syncRef.current?.dispose();
      syncRef.current = null;
    };
  }, [userId, apply]);

  const edit = useCallback(
    (change: (current: PlannerState) => PlannerState) => {
      apply(change);
      syncRef.current?.request(EDIT_SYNC_DELAY_MS);
    },
    [apply]
  );

  const addProject = useCallback(
    (input: NewProjectInput) => {
      const project = {
        title: input.title,
        color: input.color,
        dueDate: input.dueDate ? localDateKey(input.dueDate) : null,
        tasks: input.taskTitles.map((title) => ({ title })),
      };
      const now = nowIso();
      // A change is a function of the current state, so it also applies correctly when it is
      // replayed on top of state that finished loading after the edit.
      const change = (current: PlannerState) =>
        createProject(current, project, newId, now)?.state ?? current;
      if (change(stateRef.current) === stateRef.current) return false;
      edit(change);
      return true;
    },
    [edit]
  );

  const deleteProject = useCallback(
    (projectId: string) => edit((current) => deleteProjectRecord(current, projectId, nowIso())),
    [edit]
  );

  const toggleTask = useCallback(
    (_projectId: string, taskId: string) => {
      haptics.tap();
      edit((current) => {
        const task = current.tasks[taskId];
        return task ? setTaskCompleted(current, taskId, !task.isCompleted, nowIso()) : current;
      });
    },
    [edit]
  );

  const completeTaskById = useCallback(
    (_projectId: string, taskId: string) => {
      haptics.success();
      edit((current) => setTaskCompleted(current, taskId, true, nowIso()));
    },
    [edit]
  );

  const getNextStep = useCallback(
    (project: Project): Task | null => project.tasks.find((task) => !task.isCompleted) ?? null,
    []
  );

  const projects = useMemo(() => selectProjects(state), [state]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      addProject,
      deleteProject,
      toggleTask,
      completeTaskById,
      getNextStep,
      generateSubtasks: generateSampleSubtasks,
    }),
    [projects, addProject, deleteProject, toggleTask, completeTaskById, getNextStep]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}

/** Due date in the active language. */
export function formatDueDate(date?: Date): string | undefined {
  if (!date) return undefined;
  return date.toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
