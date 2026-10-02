import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, Circle, CheckCircle2, Play, Trash2 } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Project, Task, formatDueDate, useProjects } from '../../context/ProjectContext';
import { FocusMode, SessionCompletionModal, SessionSetupModal, SessionConfig } from '../../modals';
import { recordFocusSession } from '../../lib/stats/sessionStore';
import { useAudioContext } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../feedback/Dialog';
import { haptics } from '../../lib/ui/haptics';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// ============================================================================
// ANIMATED PROGRESS BAR COMPONENT
// ============================================================================

interface AnimatedProgressBarProps {
  progress: number;
  color: string;
}

const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({ progress, color }) => {
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, {
      duration: 400,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [animatedProgress, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value}%`,
    backgroundColor: color,
  }));

  return (
    <View style={styles.progressBar}>
      <Animated.View style={[styles.progressFill, progressStyle]} />
    </View>
  );
};

// ============================================================================
// TASK ITEM COMPONENT
// ============================================================================

interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  onStartFocus: (task: Task) => void;
  isNextStep?: boolean;
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggle,
  onStartFocus,
  isNextStep = false,
}) => {
  const { t } = useTranslation();
  const handleStartFocus = useCallback(() => {
    haptics.press();
    onStartFocus(task);
  }, [task, onStartFocus]);

  const handleToggle = useCallback(() => {
    haptics.tap();
    onToggle();
  }, [onToggle]);

  // Silent Focus: Next step is fully visible, others are muted
  const itemOpacity = isNextStep && !task.isCompleted ? 1 : 0.6;

  return (
    <View style={[styles.taskItem, { opacity: itemOpacity }]}>
      <TouchableOpacity
        onPress={handleToggle}
        style={styles.taskCheckbox}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="checkbox"
        accessibilityLabel={task.title}
        accessibilityState={{ checked: task.isCompleted }}
      >
        {task.isCompleted ? (
          <CheckCircle2 size={20} color="#34D399" strokeWidth={2} />
        ) : (
          <Circle size={20} color="rgba(255,255,255,0.4)" strokeWidth={2} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.taskTextContainer}
        onPress={handleStartFocus}
        disabled={task.isCompleted}
        accessibilityRole="button"
        accessibilityLabel={t('planner.startFocusOn', { title: task.title })}
        accessibilityState={{ disabled: task.isCompleted }}
      >
        <Text
          style={[
            styles.taskText,
            task.isCompleted && styles.taskTextCompleted,
            isNextStep && !task.isCompleted && styles.taskTextNextStep,
          ]}
        >
          {task.title}
        </Text>
      </TouchableOpacity>

      {/* Play button - static, no animations, monochrome unless next step */}
      {!task.isCompleted && (
        <TouchableOpacity
          onPress={handleStartFocus}
          style={[styles.taskPlayButton, isNextStep && styles.taskPlayButtonActive]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('planner.startFocusOn', { title: task.title })}
        >
          <Play
            size={14}
            color={isNextStep ? '#8B5CF6' : '#71717a'}
            fill={isNextStep ? '#8B5CF6' : '#71717a'}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================================
// NEXT STEP PREVIEW COMPONENT (Collapsed State)
// ============================================================================

interface NextStepPreviewProps {
  task: Task;
  onStartFocus: (task: Task) => void;
}

const NextStepPreview: React.FC<NextStepPreviewProps> = ({ task, onStartFocus }) => {
  const { t } = useTranslation();
  const handleStartFocus = useCallback(() => {
    haptics.press();
    onStartFocus(task);
  }, [task, onStartFocus]);

  return (
    <TouchableOpacity
      style={styles.nextStepContainer}
      onPress={handleStartFocus}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t('planner.startFocusOn', { title: task.title })}
    >
      <View style={styles.nextStepLabelRow}>
        <Text style={styles.nextStepLabel}>{t('planner.nextStep')}</Text>
        {/* Static play icon - no animation, monochrome */}
        <Play size={12} color="#71717a" fill="#71717a" style={{ marginLeft: 6 }} />
      </View>
      {/* Next step text is bright - full opacity white */}
      <Text style={styles.nextStepText}>{task.title}</Text>
    </TouchableOpacity>
  );
};

// ============================================================================
// PROJECT CARD COMPONENT
// ============================================================================

interface ProjectCardProps {
  project: Project;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  totalProjects: number;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  index,
  isExpanded,
  onToggle,
  totalProjects,
}) => {
  const { t } = useTranslation();
  const dialog = useDialog();
  const { toggleTask, getNextStep, completeTaskById, deleteProject } = useProjects();
  const scale = useSharedValue(1);
  const chevronRotation = useSharedValue(0);

  // Focus Mode State
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [focusModeVisible, setFocusModeVisible] = useState(false);
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const { endAudioSession } = useAudioContext();
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    durationSec: 25 * 60,
    trackId: null,
  });
  const [sessionData, setSessionData] = useState({
    duration: 0,
    pickupCount: 0,
  });

  useEffect(() => {
    chevronRotation.value = withTiming(isExpanded ? 180 : 0, {
      duration: 200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [chevronRotation, isExpanded]);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handleLongPress = async () => {
    haptics.warning();
    const confirmed = await dialog.confirm({
      title: t('planner.deleteTitle'),
      message: t('planner.deleteMessage', { title: project.title }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) deleteProject(project.id);
  };

  const handlePress = () => {
    haptics.tap();
    onToggle();
  };

  const handleToggleTask = useCallback(
    (taskId: string) => {
      toggleTask(project.id, taskId);
    },
    [project.id, toggleTask]
  );

  // ========================================================================
  // SESSION SETUP & FOCUS MODE HANDLERS
  // ========================================================================

  // Step 1: Play button opens Setup Modal
  const handleStartFocus = useCallback((task: Task) => {
    setActiveTask(task);
    setSetupModalVisible(true);
  }, []);

  // Step 2: User confirms in Setup Modal -> Open Focus Mode
  const handleSessionConfigured = useCallback((config: SessionConfig) => {
    setSessionConfig(config);
    setSetupModalVisible(false);
    // Small delay to allow setup modal to close smoothly
    setTimeout(() => {
      setFocusModeVisible(true);
    }, 100);
  }, []);

  const handleSetupModalClose = useCallback(() => {
    setSetupModalVisible(false);
    setActiveTask(null);
  }, []);

  const handleFocusModeClose = useCallback(() => {
    setFocusModeVisible(false);
    setActiveTask(null);
    // The session is over either way: whatever was playing before it comes back.
    void endAudioSession();
  }, [endAudioSession]);

  const handleSessionComplete = useCallback(
    (data: {
      duration: number;
      pickupCount: number;
      completed: boolean;
      projectId?: string;
      taskId?: string;
    }) => {
      setFocusModeVisible(false);
      void endAudioSession();

      // Insights are fed by what happened, finished or not (fire and forget).
      void recordFocusSession({
        durationSec: data.duration,
        pickupCount: data.pickupCount,
        completed: data.completed,
        source: 'timer',
        projectId: data.projectId,
        taskId: data.taskId,
      }).catch(() => {});

      // A session someone walked out of is not something to congratulate them for. It is
      // counted, and the screen simply goes back to the plan.
      if (!data.completed) {
        setActiveTask(null);
        return;
      }

      setSessionData({ duration: data.duration, pickupCount: data.pickupCount });
      setSessionModalVisible(true);
    },
    [endAudioSession]
  );

  const handleTaskCompleted = useCallback(() => {
    if (activeTask) {
      completeTaskById(project.id, activeTask.id);
    }
    setSessionModalVisible(false);
    setActiveTask(null);
  }, [activeTask, project.id, completeTaskById]);

  const handleJustSession = useCallback(() => {
    // The task stays open; the session itself was already recorded when it ended.
    setSessionModalVisible(false);
    setActiveTask(null);
  }, []);

  // ========================================================================
  // ANIMATIONS
  // ========================================================================

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(chevronRotation.value, [0, 180], [0, 180], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const nextStep = getNextStep(project);
  // Found once, rather than once per row inside the map.
  const nextStepIndex = project.tasks.findIndex((task) => !task.isCompleted);
  const formattedDueDate = formatDueDate(project.dueDate);

  return (
    <>
      <AnimatedView
        entering={FadeInRight.delay(index * 80).duration(300)}
        layout={LinearTransition.duration(200)}
        style={styles.timelineItem}
      >
        {/* Timeline connector */}
        <View style={styles.timelineConnector}>
          <View style={[styles.timelineDot, { backgroundColor: project.color }]} />
          {index < totalProjects - 1 && <View style={styles.timelineLine} />}
        </View>

        {/* Project Card */}
        <AnimatedTouchableOpacity
          style={[styles.projectCard, cardAnimatedStyle]}
          onPress={handlePress}
          onLongPress={() => void handleLongPress()}
          accessibilityRole="button"
          accessibilityLabel={project.title}
          accessibilityState={{ expanded: isExpanded }}
          accessibilityHint={t('planner.deleteHint')}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.colorIndicator, { backgroundColor: project.color }]} />
              <Text style={styles.projectTitle} numberOfLines={2} ellipsizeMode="tail">
                {project.title}
              </Text>
            </View>
            <Animated.View style={chevronAnimatedStyle}>
              <ChevronDown size={20} color="rgba(255,255,255,0.5)" />
            </Animated.View>
          </View>

          {/* Progress Bar - Animated */}
          <View style={styles.progressContainer}>
            <AnimatedProgressBar progress={project.progress} color={project.color} />
            <Text style={styles.progressText}>{project.progress}%</Text>
          </View>

          {/* Next Step (Collapsed) or All Tasks (Expanded) */}
          {!isExpanded && nextStep && (
            <NextStepPreview task={nextStep} onStartFocus={handleStartFocus} />
          )}

          {/* Due Date */}
          {formattedDueDate && !isExpanded && (
            <Text style={styles.dueDate}>{t('planner.due', { date: formattedDueDate })}</Text>
          )}

          {/* Expanded Tasks */}
          {isExpanded && (
            <AnimatedView entering={FadeInDown.duration(200)} style={styles.tasksContainer}>
              <View style={styles.tasksDivider} />
              <Text style={styles.tasksTitle}>{t('planner.subtasks')}</Text>
              {project.tasks.map((task, taskIndex) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggleTask(task.id)}
                  onStartFocus={handleStartFocus}
                  isNextStep={taskIndex === nextStepIndex}
                />
              ))}

              {/* Due Date in expanded view */}
              {formattedDueDate && (
                <Text style={[styles.dueDate, { marginTop: 12 }]}>
                  {t('planner.due', { date: formattedDueDate })}
                </Text>
              )}

              {/* Long-pressing the card deletes it too, but nothing on screen said so. */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => void handleLongPress()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('planner.deleteTitle')}
              >
                <Trash2 size={14} color="rgba(255,255,255,0.35)" strokeWidth={2} />
                <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </AnimatedView>
          )}
        </AnimatedTouchableOpacity>
      </AnimatedView>

      {/* Session Setup Modal (The Cockpit) */}
      <SessionSetupModal
        visible={setupModalVisible}
        onClose={handleSetupModalClose}
        taskTitle={activeTask?.title || ''}
        onStartSession={handleSessionConfigured}
      />

      {/* Focus Mode Modal */}
      <FocusMode
        visible={focusModeVisible}
        onClose={handleFocusModeClose}
        duration={sessionConfig.durationSec}
        taskTitle={activeTask?.title || ''}
        projectId={project.id}
        taskId={activeTask?.id}
        onSessionComplete={handleSessionComplete}
      />

      {/* Session Completion Modal */}
      <SessionCompletionModal
        visible={sessionModalVisible}
        onClose={handleJustSession}
        sessionDuration={sessionData.duration}
        pickupCount={sessionData.pickupCount}
        taskTitle={activeTask?.title || ''}
        onTaskCompleted={handleTaskCompleted}
        onJustSession={handleJustSession}
      />
    </>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineConnector: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 20,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 4,
  },
  projectCard: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  projectTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    width: 36,
    textAlign: 'right',
  },
  nextStepContainer: {
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    // Silent Focus: Subtle container, not attention-grabbing
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  nextStepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  nextStepLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717a', // Muted zinc
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextStepText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF', // Full brightness - the "anchor"
    fontWeight: '600',
    marginTop: 2,
  },
  dueDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  tasksContainer: {
    marginTop: 12,
  },
  tasksDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  tasksTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 10,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskCheckbox: {
    marginRight: 10,
  },
  taskTextContainer: {
    flex: 1,
  },
  taskText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  taskTextCompleted: {
    color: 'rgba(255, 255, 255, 0.4)',
    textDecorationLine: 'line-through',
  },
  taskTextNextStep: {
    color: '#A78BFA',
    fontWeight: '500',
  },
  taskPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    // Silent Focus: Muted background
    backgroundColor: 'rgba(113, 113, 122, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  taskPlayButtonActive: {
    // Only the next step gets the accent color
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.35)',
  },
});
