import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabase } from '../../data/supabase/client';
import type { ProjectRecord, TaskRecord } from './model';
import { RemoteError, type PlannerRemote, type RemoteRow } from './syncEngine';

const PAGE_SIZE = 1000;

const PROJECT_COLUMNS = 'id, title, color, due_date, client_updated_at, deleted_at, updated_at';
const TASK_COLUMNS =
  'id, project_id, title, is_completed, position, client_updated_at, deleted_at, updated_at';

/**
 * Only errors that the same rows would hit again are permanent: bad data (22), a violated
 * constraint (23) and a refused permission (42501). A missing table or column (42P01, PGRST204,
 * PGRST205) is a deployment that has not run its migration yet, so it is retried rather than
 * dropping every pending change.
 */
export function isPermanent(error: Pick<PostgrestError, 'code'>): boolean {
  return /^2[23]/.test(error.code ?? '') || error.code === '42501';
}

function toRemoteError(error: PostgrestError): RemoteError {
  return new RemoteError(`${error.code || 'network'}: ${error.message}`, isPermanent(error));
}

function client() {
  try {
    return getSupabase();
  } catch (error) {
    throw new RemoteError(error instanceof Error ? error.message : 'backend unavailable', false);
  }
}

/**
 * Reads every row changed since `since`, in pages. Each page starts at the last timestamp of the
 * previous one (inclusive), so rows sharing that timestamp are never skipped; they are merged
 * twice instead, which is harmless. A push batch is far smaller than a page, so one timestamp can
 * never fill a whole page.
 */
async function readChanged<T extends { updated_at: string }>(
  since: string | null,
  fetchPage: (
    lowerBound: string | null
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let lowerBound = since;
  for (;;) {
    const { data, error } = await fetchPage(lowerBound);
    if (error) throw toRemoteError(error);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;

    const last = page[page.length - 1].updated_at;
    if (last === lowerBound) {
      throw new RemoteError('a whole page shares one timestamp; cannot advance', false);
    }
    lowerBound = last;
  }
}

export const plannerRemote: PlannerRemote = {
  async pushProjects(rows: ProjectRecord[]) {
    const { error } = await client()
      .from('planner_projects')
      .upsert(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          color: row.color,
          due_date: row.dueDate,
          client_updated_at: row.clientUpdatedAt,
          deleted_at: row.deletedAt,
        })),
        { onConflict: 'id' }
      );
    if (error) throw toRemoteError(error);
  },

  async pushTasks(rows: TaskRecord[]) {
    const { error } = await client()
      .from('planner_tasks')
      .upsert(
        rows.map((row) => ({
          id: row.id,
          project_id: row.projectId,
          title: row.title,
          is_completed: row.isCompleted,
          position: row.position,
          client_updated_at: row.clientUpdatedAt,
          deleted_at: row.deletedAt,
        })),
        { onConflict: 'id' }
      );
    if (error) throw toRemoteError(error);
  },

  async pull(since) {
    const supabase = client();
    const [projects, tasks] = await Promise.all([
      readChanged(since, (lowerBound) => {
        const query = supabase
          .from('planner_projects')
          .select(PROJECT_COLUMNS)
          .order('updated_at')
          .order('id')
          .limit(PAGE_SIZE);
        return lowerBound ? query.gte('updated_at', lowerBound) : query;
      }),
      readChanged(since, (lowerBound) => {
        const query = supabase
          .from('planner_tasks')
          .select(TASK_COLUMNS)
          .order('updated_at')
          .order('id')
          .limit(PAGE_SIZE);
        return lowerBound ? query.gte('updated_at', lowerBound) : query;
      }),
    ]);

    return {
      projects: projects.map((row): RemoteRow<ProjectRecord> => ({
        id: row.id,
        title: row.title,
        color: row.color,
        dueDate: row.due_date,
        clientUpdatedAt: row.client_updated_at,
        deletedAt: row.deleted_at,
        updatedAt: row.updated_at,
      })),
      tasks: tasks.map((row): RemoteRow<TaskRecord> => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        isCompleted: row.is_completed,
        position: row.position,
        clientUpdatedAt: row.client_updated_at,
        deletedAt: row.deleted_at,
        updatedAt: row.updated_at,
      })),
    };
  },
};
