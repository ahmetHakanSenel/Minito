import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { readJson, writeJson } from '../lib/storage/jsonStore';

// ============================================================================
// DATA TYPES - ADHD "Next Action" focused Project Management
// ============================================================================

export interface Task {
    id: string;
    title: string;
    isCompleted: boolean;
}

export interface Project {
    id: string;
    title: string;
    color: string; // e.g., '#8b5cf6'
    progress: number; // 0-100
    dueDate?: Date;
    tasks: Task[];
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface ProjectContextValue {
    projects: Project[];
    addProject: (project: Omit<Project, 'id' | 'progress'>) => void;
    updateProject: (id: string, updates: Partial<Omit<Project, 'id'>>) => void;
    deleteProject: (id: string) => void;
    addTask: (projectId: string, taskTitle: string) => void;
    toggleTask: (projectId: string, taskId: string) => void;
    deleteTask: (projectId: string, taskId: string) => void;
    completeTaskById: (projectId: string, taskId: string) => void;
    getNextStep: (project: Project) => Task | null;
    generateSubtasks: (projectTitle: string) => Promise<string[]>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

// ============================================================================
// PERSISTENCE
// ============================================================================

const STORAGE_KEY = 'projects';

/** Shape written to disk — dueDate serialized as ISO string */
type PersistedProject = Omit<Project, 'dueDate'> & { dueDate?: string };

function hydrateProjects(persisted: PersistedProject[]): Project[] {
    return persisted
        .filter((p) => p && typeof p.id === 'string' && Array.isArray(p.tasks))
        .map((p) => ({
            ...p,
            dueDate: p.dueDate ? new Date(p.dueDate) : undefined,
        }));
}

// ============================================================================
// DEV SEED
// ============================================================================

/**
 * Sample projects for development only, so the planner and its analytics are
 * not empty while working on them. Seeded once, on first launch with no
 * stored data; `__DEV__` is false in release builds, so this never ships.
 */
function buildDevSeedProjects(): Project[] {
    const inTwoWeeks = new Date();
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

    return [
        {
            id: 'seed-thesis',
            title: 'Bitirme Tezi',
            color: '#8B5CF6',
            progress: 50,
            dueDate: inTwoWeeks,
            tasks: [
                { id: 'seed-thesis-1', title: 'Konu belirleme', isCompleted: true },
                { id: 'seed-thesis-2', title: 'Danışman ile görüşme', isCompleted: true },
                { id: 'seed-thesis-3', title: 'Literatür taraması', isCompleted: false },
                { id: 'seed-thesis-4', title: 'Metodoloji yazımı', isCompleted: false },
            ],
        },
        {
            id: 'seed-fitness',
            title: 'Fitness Hedefi',
            color: '#34D399',
            progress: 67,
            tasks: [
                { id: 'seed-fitness-1', title: 'Spor salonu üyeliği', isCompleted: true },
                { id: 'seed-fitness-2', title: 'Antrenman programı oluştur', isCompleted: true },
                { id: 'seed-fitness-3', title: '12 haftalık program', isCompleted: false },
            ],
        },
        {
            id: 'seed-language',
            title: 'Yeni Dil Öğren',
            color: '#60A5FA',
            progress: 33,
            tasks: [
                { id: 'seed-language-1', title: 'Uygulama indir', isCompleted: true },
                { id: 'seed-language-2', title: 'İlk 100 kelime', isCompleted: false },
                { id: 'seed-language-3', title: 'Temel gramer', isCompleted: false },
            ],
        },
    ];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const calculateProgress = (tasks: Task[]): number => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.isCompleted).length;
    return Math.round((completed / tasks.length) * 100);
};

// ============================================================================
// AI SUBTASK GENERATION STUB
// This will be connected to the AI backend later
// ============================================================================

/**
 * Stub function for AI-powered subtask generation.
 * This will be connected to the AI backend to auto-populate task lists.
 * 
 * @param projectTitle - The title of the project to generate subtasks for
 * @returns Promise<string[]> - Array of suggested subtask titles
 */
const generateSubtasksStub = async (projectTitle: string): Promise<string[]> => {
    // TODO: Connect to AI backend
    // Example API call structure:
    // const response = await fetch('/api/ai/generate-subtasks', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ projectTitle }),
    // });
    // return response.json();

    // For now, return mock suggestions based on common project types
    console.log(`[AI Stub] Generating subtasks for: ${projectTitle}`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock intelligent suggestions
    const mockSuggestions: Record<string, string[]> = {
        'tez': [
            'Konu araştırması yap',
            'Kaynak topla',
            'Taslak oluştur',
            'İlk bölümü yaz',
            'Danışmana gönder',
        ],
        'fitness': [
            'Hedef belirle',
            'Program oluştur',
            'İlk antrenman',
            'Beslenme planı',
            'Haftalık değerlendirme',
        ],
        'dil': [
            'Temel kelimeleri öğren',
            'Günlük pratik yap',
            'Konuşma pratiği',
            'Gramer çalış',
            'Film/dizi izle',
        ],
    };

    const lowerTitle = projectTitle.toLowerCase();
    for (const [key, suggestions] of Object.entries(mockSuggestions)) {
        if (lowerTitle.includes(key)) {
            return suggestions;
        }
    }

    // Default suggestions
    return [
        'İlk adımı belirle',
        'Araştırma yap',
        'Plan oluştur',
        'Uygulamaya başla',
        'Değerlendir',
    ];
};

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface ProjectProviderProps {
    children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const isHydratedRef = useRef(false);

    // Load persisted projects once on mount
    useEffect(() => {
        let cancelled = false;
        readJson<PersistedProject[]>(STORAGE_KEY).then((stored) => {
            if (cancelled) return;
            if (stored) {
                setProjects(hydrateProjects(stored));
            } else if (__DEV__) {
                // No stored file at all = first launch. An existing but empty
                // list stays empty, so clearing projects in dev stays cleared.
                setProjects(buildDevSeedProjects());
            }
            isHydratedRef.current = true;
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Persist on every change — but never before hydration completes,
    // or the initial empty state would wipe the stored data
    useEffect(() => {
        if (!isHydratedRef.current) return;
        writeJson(STORAGE_KEY, projects);
    }, [projects]);

    const addProject = useCallback((project: Omit<Project, 'id' | 'progress'>) => {
        const newProject: Project = {
            ...project,
            id: generateId(),
            progress: calculateProgress(project.tasks),
        };
        setProjects(prev => [...prev, newProject]);
    }, []);

    const updateProject = useCallback((id: string, updates: Partial<Omit<Project, 'id'>>) => {
        setProjects(prev =>
            prev.map(p => {
                if (p.id !== id) return p;
                const updated = { ...p, ...updates };
                // Recalculate progress if tasks changed
                if (updates.tasks) {
                    updated.progress = calculateProgress(updates.tasks);
                }
                return updated;
            })
        );
    }, []);

    const deleteProject = useCallback((id: string) => {
        setProjects(prev => prev.filter(p => p.id !== id));
    }, []);

    const addTask = useCallback((projectId: string, taskTitle: string) => {
        setProjects(prev =>
            prev.map(p => {
                if (p.id !== projectId) return p;
                const newTask: Task = {
                    id: generateId(),
                    title: taskTitle,
                    isCompleted: false,
                };
                const newTasks = [...p.tasks, newTask];
                return {
                    ...p,
                    tasks: newTasks,
                    progress: calculateProgress(newTasks),
                };
            })
        );
    }, []);

    const toggleTask = useCallback((projectId: string, taskId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setProjects(prev =>
            prev.map(p => {
                if (p.id !== projectId) return p;
                const newTasks = p.tasks.map(t =>
                    t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
                );
                return {
                    ...p,
                    tasks: newTasks,
                    progress: calculateProgress(newTasks),
                };
            })
        );
    }, []);

    const deleteTask = useCallback((projectId: string, taskId: string) => {
        setProjects(prev =>
            prev.map(p => {
                if (p.id !== projectId) return p;
                const newTasks = p.tasks.filter(t => t.id !== taskId);
                return {
                    ...p,
                    tasks: newTasks,
                    progress: calculateProgress(newTasks),
                };
            })
        );
    }, []);

    const completeTaskById = useCallback((projectId: string, taskId: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setProjects(prev =>
            prev.map(p => {
                if (p.id !== projectId) return p;
                const newTasks = p.tasks.map(t =>
                    t.id === taskId ? { ...t, isCompleted: true } : t
                );
                return {
                    ...p,
                    tasks: newTasks,
                    progress: calculateProgress(newTasks),
                };
            })
        );
    }, []);

    const getNextStep = useCallback((project: Project): Task | null => {
        return project.tasks.find(t => !t.isCompleted) || null;
    }, []);

    const value: ProjectContextValue = {
        projects,
        addProject,
        updateProject,
        deleteProject,
        addTask,
        toggleTask,
        deleteTask,
        completeTaskById,
        getNextStep,
        generateSubtasks: generateSubtasksStub,
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
}

// ============================================================================
// HOOK
// ============================================================================

export function useProjects() {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProjects must be used within a ProjectProvider');
    }
    return context;
}

// ============================================================================
// UTILITY: Format due date in Turkish
// ============================================================================

export function formatDueDate(date?: Date): string | undefined {
    if (!date) return undefined;

    const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
}
