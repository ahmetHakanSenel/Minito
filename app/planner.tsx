import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Plus, X, Sparkles, Trash2, ListChecks } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useProjects } from '../src/context/ProjectContext';
import { TITLE_LIMITS } from '../src/features/planner/model';
import { ProjectCard } from '../src/components/planner/ProjectCard';
import { EmptyState } from '../src/components/feedback/EmptyState';
import { haptics } from '../src/lib/ui/haptics';

const AnimatedView = Animated.createAnimatedComponent(View);

const demoStyles = StyleSheet.create({
  badge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  badgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  note: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
});

// ============================================================================
// ADD PROJECT MODAL COMPONENT
// ============================================================================

interface ManualTask {
  id: string;
  title: string;
}

interface AddProjectModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, color: string, manualTasks: string[]) => void;
  onGenerateSubtasks: (title: string) => Promise<string[]>;
}

const PROJECT_COLORS = ['#8B5CF6', '#34D399', '#60A5FA', '#F472B6', '#FBBF24', '#F87171'];

// Six unlabelled circles are six identical buttons to a screen reader.
const PROJECT_COLOR_NAMES: Record<string, string> = {
  '#8B5CF6': 'planner.colors.purple',
  '#34D399': 'planner.colors.green',
  '#60A5FA': 'planner.colors.blue',
  '#F472B6': 'planner.colors.pink',
  '#FBBF24': 'planner.colors.amber',
  '#F87171': 'planner.colors.red',
};

const AddProjectModal: React.FC<AddProjectModalProps> = ({
  visible,
  onClose,
  onAdd,
  onGenerateSubtasks,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<string[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  // A counter, not a timestamp: two subtasks added in the same millisecond would share a key,
  // and React would then reuse one row's state for the other.
  const lastTaskId = useRef(0);

  const nextTaskId = () => {
    lastTaskId.current += 1;
    return `task-${lastTaskId.current}`;
  };

  // A new subtask lands below the fold once the list is long. Bring it into view, after the
  // layout that added it.
  const revealNewTask = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const handleClose = () => {
    setTitle('');
    setSelectedColor(PROJECT_COLORS[0]);
    setSuggestedTasks([]);
    setManualTasks([]);
    setNewTaskText('');
    onClose();
  };

  const handleAdd = () => {
    if (title.trim()) {
      haptics.success();
      onAdd(
        title.trim(),
        selectedColor,
        manualTasks.map((task) => task.title)
      );
      handleClose();
    }
  };

  const handleAddManualTask = () => {
    if (newTaskText.trim()) {
      haptics.tap();
      setManualTasks((prev) => [...prev, { id: nextTaskId(), title: newTaskText.trim() }]);
      setNewTaskText('');
      revealNewTask();
    }
  };

  const handleRemoveManualTask = (id: string) => {
    haptics.tap();
    setManualTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const handleAddSuggestedToManual = (task: string) => {
    haptics.tap();
    if (manualTasks.some((existing) => existing.title === task)) return;
    setManualTasks((prev) => [...prev, { id: nextTaskId(), title: task }]);
    revealNewTask();
  };

  const handleGenerateSubtasks = async () => {
    if (!title.trim()) return;
    setIsGenerating(true);
    haptics.press();
    try {
      const tasks = await onGenerateSubtasks(title.trim());
      setSuggestedTasks(tasks);
    } catch (error) {
      console.error('Failed to generate subtasks:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Without this the overlay stops short of the status bar on Android, leaving a strip of
      // the screen behind it showing through.
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* iOS reports the keyboard to JavaScript; on Android the window resizes underneath. */}
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <AnimatedView
          entering={SlideInUp.duration(300).easing(Easing.out(Easing.cubic))}
          exiting={FadeOut.duration(200)}
          style={modalStyles.container}
        >
          {/* Header: pinned, so the way out never scrolls off the screen. */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{t('planner.newProject')}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={modalStyles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <X size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* The sheet grows with every subtask, so past a point the middle has to scroll. */}
          <ScrollView
            ref={scrollRef}
            style={modalStyles.body}
            contentContainerStyle={modalStyles.bodyContent}
            showsVerticalScrollIndicator={false}
            // A tap on add or delete lands on the button, instead of only closing the keyboard.
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Title Input */}
            <View style={modalStyles.inputContainer}>
              <Text style={modalStyles.label}>{t('planner.projectName')}</Text>
              <TextInput
                style={modalStyles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t('planner.projectNamePlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.3)"
                // The ceiling the planner model already enforces, so nothing the person types
                // is silently cut off after the fact.
                maxLength={TITLE_LIMITS.project}
                returnKeyType="next"
              />
            </View>

            {/* Color Picker */}
            <View style={modalStyles.colorSection}>
              <Text style={modalStyles.label}>{t('planner.color')}</Text>
              <View style={modalStyles.colorGrid}>
                {PROJECT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      modalStyles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && modalStyles.colorSelected,
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setSelectedColor(color);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={t(PROJECT_COLOR_NAMES[color])}
                    accessibilityState={{ selected: selectedColor === color }}
                  />
                ))}
              </View>
            </View>

            {/* Sample subtask suggestions, labeled as a demo until AI planning ships */}
            <TouchableOpacity
              style={[modalStyles.aiButton, !title.trim() && { opacity: 0.5 }]}
              onPress={handleGenerateSubtasks}
              disabled={!title.trim() || isGenerating}
            >
              <Sparkles size={18} color="#FBBF24" />
              <Text style={modalStyles.aiButtonText}>
                {isGenerating ? t('planner.demoSuggesting') : t('planner.demoSuggest')}
              </Text>
              <View style={demoStyles.badge}>
                <Text style={demoStyles.badgeText}>{t('planner.demoBadge')}</Text>
              </View>
            </TouchableOpacity>
            <Text style={demoStyles.note}>{t('planner.demoNote')}</Text>

            {/* Suggested Tasks Preview */}
            {suggestedTasks.length > 0 && (
              <AnimatedView entering={FadeIn.duration(200)} style={modalStyles.suggestedContainer}>
                <Text style={modalStyles.suggestedTitle}>{t('planner.suggestionsTitle')}</Text>
                {suggestedTasks.map((task) => {
                  const alreadyAdded = manualTasks.some((existing) => existing.title === task);
                  return (
                    <TouchableOpacity
                      key={task}
                      style={[
                        modalStyles.suggestedTaskButton,
                        alreadyAdded && modalStyles.suggestedTaskButtonAdded,
                      ]}
                      onPress={() => handleAddSuggestedToManual(task)}
                      disabled={alreadyAdded}
                      accessibilityRole="button"
                      accessibilityLabel={task}
                      accessibilityState={{ disabled: alreadyAdded }}
                    >
                      {/* Tapping an already-added suggestion did nothing, and looked no
                          different from one that would. */}
                      {alreadyAdded ? (
                        <Check size={14} color="rgba(255,255,255,0.35)" />
                      ) : (
                        <Plus size={14} color="#8B5CF6" />
                      )}
                      <Text
                        style={[
                          modalStyles.suggestedTask,
                          alreadyAdded && modalStyles.suggestedTaskAdded,
                        ]}
                      >
                        {task}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </AnimatedView>
            )}

            {/* Manual Task Input */}
            <View style={modalStyles.manualTaskSection}>
              <Text style={modalStyles.label}>{t('planner.subtasks')}</Text>
              <View style={modalStyles.manualTaskInputRow}>
                <TextInput
                  style={modalStyles.manualTaskInput}
                  value={newTaskText}
                  onChangeText={setNewTaskText}
                  placeholder={t('planner.subtaskPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  onSubmitEditing={handleAddManualTask}
                  // Stays open for the next one: adding several subtasks in a row is the
                  // normal way this sheet is used.
                  blurOnSubmit={false}
                  maxLength={TITLE_LIMITS.task}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={modalStyles.manualTaskAddButton}
                  onPress={handleAddManualTask}
                  disabled={!newTaskText.trim()}
                  accessibilityRole="button"
                  accessibilityLabel={t('planner.addSubtask')}
                  accessibilityState={{ disabled: !newTaskText.trim() }}
                >
                  <Plus
                    size={20}
                    color={newTaskText.trim() ? '#8B5CF6' : 'rgba(255,255,255,0.3)'}
                  />
                </TouchableOpacity>
              </View>

              {/* Added Tasks List */}
              {manualTasks.length > 0 && (
                <View style={modalStyles.manualTasksList}>
                  {manualTasks.map((task) => (
                    <View key={task.id} style={modalStyles.manualTaskItem}>
                      <Text style={modalStyles.manualTaskText}>{task.title}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveManualTask(task.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('planner.removeSubtask', { title: task.title })}
                      >
                        <Trash2 size={16} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Create stays in reach however long the subtask list grows. */}
          <TouchableOpacity
            style={[modalStyles.addButton, !title.trim() && { opacity: 0.5 }]}
            onPress={handleAdd}
            disabled={!title.trim()}
            accessibilityRole="button"
            accessibilityState={{ disabled: !title.trim() }}
          >
            <LinearGradient
              colors={['#8B5CF6', '#6D28D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={modalStyles.addButtonGradient}
            >
              <Text style={modalStyles.addButtonText}>{t('planner.create')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </AnimatedView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: 'rgba(30, 30, 46, 0.98)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    // The sheet grows with its content, but never past the screen: beyond this the middle
    // scrolls instead of pushing the create button off the bottom.
    maxHeight: '86%',
  },
  body: {
    // Without this the scroll view claims its full content height and the sheet overflows
    // again; shrinking is what lets the container's maxHeight actually bind.
    flexShrink: 1,
  },
  bodyContent: {
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  colorSection: {
    marginBottom: 20,
  },
  colorGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    marginBottom: 16,
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FBBF24',
  },
  suggestedContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  suggestedTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  suggestedTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 8,
    marginBottom: 6,
  },
  suggestedTask: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  suggestedTaskButtonAdded: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  suggestedTaskAdded: {
    color: 'rgba(255, 255, 255, 0.35)',
    textDecorationLine: 'line-through',
  },
  manualTaskSection: {
    marginBottom: 16,
  },
  manualTaskInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualTaskInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  manualTaskAddButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  manualTasksList: {
    marginTop: 12,
  },
  manualTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  manualTaskText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
  },
  addButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// ============================================================================
// PLANNER SCREEN
// ============================================================================

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function PlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { projects, addProject, generateSubtasks } = useProjects();
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Soonest deadline first; a project without one sits at the end rather than the top.
  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      }),
    [projects]
  );

  const handleBack = () => {
    haptics.tap();
    // Navigate back to home and open DashboardModal (Control Center)
    router.replace({
      pathname: '/',
      params: { openDashboard: 'true' },
    });
  };

  const handleToggleProject = (projectId: string) => {
    setExpandedProject(expandedProject === projectId ? null : projectId);
  };

  const handleAddProject = useCallback(
    // Only the subtasks the person typed or picked from the samples; nothing is invented here.
    (title: string, color: string, taskTitles: string[]) => {
      addProject({ title, color, taskTitles });
    },
    [addProject]
  );

  const handleOpenAddModal = () => {
    haptics.tap();
    setShowAddModal(true);
  };

  // One button, two surfaces: it must not be written twice and drift.
  const addButton = (
    <TouchableOpacity
      style={styles.dockedAddButton}
      onPress={handleOpenAddModal}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t('planner.newProject')}
    >
      <Plus size={18} color="#71717a" strokeWidth={2} />
      <Text style={styles.dockedAddText}>{t('planner.newProject')}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('planner.title')}</Text>
        {/* Removed header add button - using bottom bar instead */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Timeline */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section Title */}
        <Text style={styles.sectionTitle}>{t('planner.activeProjects')}</Text>

        {/* Empty State */}
        {sortedProjects.length === 0 && (
          <EmptyState
            icon={ListChecks}
            title={t('planner.emptyTitle')}
            description={t('planner.emptyText')}
            action={{ label: t('planner.emptyAction'), onPress: () => setShowAddModal(true) }}
          />
        )}

        {/* Timeline View */}
        <View style={styles.timeline}>
          {sortedProjects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={index}
              isExpanded={expandedProject === project.id}
              onToggle={() => handleToggleProject(project.id)}
              totalProjects={sortedProjects.length}
            />
          ))}
        </View>

        {/* Bottom padding for the docked bar and device gesture area */}
        <View style={{ height: 80 + insets.bottom }} />
      </ScrollView>

      {/* Add Project Modal */}
      <AddProjectModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddProject}
        onGenerateSubtasks={generateSubtasks}
      />

      {/* The one way to add a project, docked clear of the system gesture area. */}
      <View style={[styles.dockedBottomBar, { paddingBottom: insets.bottom }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="dark" style={styles.bottomBarSurface}>
            {addButton}
          </BlurView>
        ) : (
          // Android's blur is costly and uneven across versions; a flat surface reads the same.
          <View style={[styles.bottomBarSurface, styles.androidBottomBar]}>{addButton}</View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
    marginLeft: 40,
  },
  timeline: {
    paddingLeft: 20,
  },
  // Docked Bottom Bar - "Silent Focus" Design
  dockedBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // As tall as its button plus whatever the system reserves below it, so the button never
    // ends up under a home indicator.
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomBarSurface: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  androidBottomBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  dockedAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  dockedAddText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#71717a', // Muted zinc tone
    letterSpacing: 0.3,
  },
});
