/**
 * Offline Mode Logic - Fallback Content
 *
 * Provides static fallback steps for critical task categories when the API is unavailable.
 * This ensures users can still get help even when offline or when services are down.
 */

export enum TaskCategory {
  CLEANING = 'cleaning',
  STUDY = 'study',
  WORK = 'work',
  HEALTH = 'health',
  SOCIAL = 'social',
  FINANCIAL = 'financial',
  GENERAL = 'general',
}

export interface FallbackSteps {
  category: TaskCategory;
  steps: string[];
}

/**
 * Categorizes a task input based on keywords
 */
export function categorizeTask(input: string): TaskCategory {
  const lowerInput = input.toLowerCase();

  // Cleaning keywords
  if (
    lowerInput.includes('clean') ||
    lowerInput.includes('tidy') ||
    lowerInput.includes('organize') ||
    lowerInput.includes('declutter') ||
    lowerInput.includes('room') ||
    lowerInput.includes('house') ||
    lowerInput.includes('apartment')
  ) {
    return TaskCategory.CLEANING;
  }

  // Study keywords
  if (
    lowerInput.includes('study') ||
    lowerInput.includes('learn') ||
    lowerInput.includes('exam') ||
    lowerInput.includes('homework') ||
    lowerInput.includes('assignment') ||
    lowerInput.includes('read') ||
    lowerInput.includes('course')
  ) {
    return TaskCategory.STUDY;
  }

  // Work keywords
  if (
    lowerInput.includes('work') ||
    lowerInput.includes('project') ||
    lowerInput.includes('meeting') ||
    lowerInput.includes('deadline') ||
    lowerInput.includes('task') ||
    lowerInput.includes('report')
  ) {
    return TaskCategory.WORK;
  }

  // Health keywords
  if (
    lowerInput.includes('exercise') ||
    lowerInput.includes('workout') ||
    lowerInput.includes('health') ||
    lowerInput.includes('fitness') ||
    lowerInput.includes('diet') ||
    lowerInput.includes('meditation')
  ) {
    return TaskCategory.HEALTH;
  }

  // Social keywords
  if (
    lowerInput.includes('friend') ||
    lowerInput.includes('social') ||
    lowerInput.includes('party') ||
    lowerInput.includes('event') ||
    lowerInput.includes('meet')
  ) {
    return TaskCategory.SOCIAL;
  }

  // Financial keywords
  if (
    lowerInput.includes('money') ||
    lowerInput.includes('budget') ||
    lowerInput.includes('save') ||
    lowerInput.includes('bill') ||
    lowerInput.includes('payment') ||
    lowerInput.includes('financial')
  ) {
    return TaskCategory.FINANCIAL;
  }

  return TaskCategory.GENERAL;
}

/**
 * Gets fallback steps for a given category
 */
export function getFallbackSteps(category: TaskCategory): string[] {
  const fallbackContent: Record<TaskCategory, string[]> = {
    [TaskCategory.CLEANING]: [
      'Start with one small area (e.g., your desk or a corner)',
      'Gather cleaning supplies: trash bag, cleaning cloth, and a container for items to relocate',
      'Sort items into three piles: keep, donate, and trash',
      'Clean surfaces with appropriate cleaner',
      'Put items back in their designated places',
      'Take out trash and recycling',
      'Take a moment to appreciate your clean space',
    ],

    [TaskCategory.STUDY]: [
      'Find a quiet, distraction-free space',
      'Gather all necessary materials (books, notes, laptop, etc.)',
      'Break the material into smaller, manageable chunks',
      'Set a timer for focused study sessions (e.g., 25 minutes)',
      'Take short breaks between sessions (5-10 minutes)',
      'Use active recall: test yourself on what you learned',
      'Review and summarize key points at the end',
    ],

    [TaskCategory.WORK]: [
      'Clarify the goal and expected outcome',
      'Break the project into smaller tasks',
      'Prioritize tasks by importance and deadline',
      'Set specific time blocks for each task',
      'Remove distractions (phone, notifications)',
      'Start with the most challenging task when energy is highest',
      'Review progress and adjust plan as needed',
    ],

    [TaskCategory.HEALTH]: [
      'Choose an activity that feels achievable today',
      'Set a specific time and place',
      'Prepare any needed equipment or clothing',
      'Start with a warm-up or gentle movement',
      'Do the activity at your own pace',
      'Cool down and stretch afterward',
      'Hydrate and rest as needed',
    ],

    [TaskCategory.SOCIAL]: [
      'Identify what kind of social interaction you need',
      'Reach out to one person you trust',
      'Suggest a specific activity or time',
      'Be flexible if plans need to change',
      'Focus on quality time over quantity',
      'Respect your own boundaries and energy levels',
      'Follow up afterward to maintain connection',
    ],

    [TaskCategory.FINANCIAL]: [
      'Gather all relevant financial documents',
      'Review your current financial situation',
      'Identify your financial goals',
      'Create a simple budget or spending plan',
      'Set up automatic savings if possible',
      'Track expenses for a week to see patterns',
      'Make one small change to improve your financial health',
    ],

    [TaskCategory.GENERAL]: [
      'Break the task into smaller, specific steps',
      'Identify what resources or tools you need',
      'Set a realistic deadline or time frame',
      'Start with the easiest or most motivating step',
      'Work on it for a set amount of time (e.g., 15 minutes)',
      'Take breaks when needed',
      'Celebrate small wins along the way',
    ],
  };

  return fallbackContent[category] || fallbackContent[TaskCategory.GENERAL];
}

/**
 * Gets fallback steps for a task input
 * This is used when the API is unavailable (offline mode)
 */
export function getOfflineFallbackSteps(input: string): string[] {
  const category = categorizeTask(input);
  return getFallbackSteps(category);
}
