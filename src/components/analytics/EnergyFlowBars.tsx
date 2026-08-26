import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Briefcase,
  GraduationCap,
  Heart,
  Code,
  PenTool,
  Music,
  Dumbbell,
  Book,
  Home,
  Sparkles,
} from 'lucide-react-native';

type ProjectType =
  | 'work'
  | 'study'
  | 'health'
  | 'coding'
  | 'creative'
  | 'music'
  | 'fitness'
  | 'reading'
  | 'personal'
  | 'other';

interface ProjectEnergy {
  id: string;
  name: string;
  type: ProjectType;
  focusMinutes: number;
}

interface EnergyFlowBarsProps {
  /** Array of projects with focus time */
  projects: ProjectEnergy[];
  /** Maximum number of projects to display */
  maxProjects?: number;
}

// Icon mapping for project types
const getProjectIcon = (type: ProjectType, color: string) => {
  const iconProps = { size: 18, color, strokeWidth: 1.8 };
  
  const icons: Record<ProjectType, JSX.Element> = {
    work: <Briefcase {...iconProps} />,
    study: <GraduationCap {...iconProps} />,
    health: <Heart {...iconProps} />,
    coding: <Code {...iconProps} />,
    creative: <PenTool {...iconProps} />,
    music: <Music {...iconProps} />,
    fitness: <Dumbbell {...iconProps} />,
    reading: <Book {...iconProps} />,
    personal: <Home {...iconProps} />,
    other: <Sparkles {...iconProps} />,
  };
  
  return icons[type] || icons.other;
};

// Color palette for different projects (ethereal, non-jarring)
const projectColors: string[] = [
  '#A78BFA', // Purple
  '#818CF8', // Indigo
  '#7DD3FC', // Sky
  '#5EEAD4', // Teal
  '#86EFAC', // Green
  '#FDE68A', // Amber
  '#FCA5A5', // Red
  '#F9A8D4', // Pink
];

export const EnergyFlowBars: React.FC<EnergyFlowBarsProps> = ({
  projects,
  maxProjects = 5,
}) => {
  const { width } = useWindowDimensions();
  
  // Sort by focus time and take top N
  const sortedProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => b.focusMinutes - a.focusMinutes)
      .slice(0, maxProjects);
  }, [projects, maxProjects]);

  const maxMinutes = useMemo(
    () => Math.max(...sortedProjects.map(p => p.focusMinutes), 1),
    [sortedProjects]
  );

  // Calculate bar width percentage
  const getBarWidth = (minutes: number): number => {
    return Math.max((minutes / maxMinutes) * 100, 8); // Minimum 8% width
  };

  const barMaxWidth = width - 120; // Account for icon and padding

  if (sortedProjects.length === 0) {
    return (
      <Animated.View 
        entering={FadeInUp.delay(600).duration(500)}
        style={styles.container}
      >
        <Text style={styles.sectionTitle}>Enerji Akışı</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Henüz proje verisi yok</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      entering={FadeInUp.delay(600).duration(500)}
      style={styles.container}
    >
      <Text style={styles.sectionTitle}>Enerji Akışı</Text>
      
      <View style={styles.barsContainer}>
        {sortedProjects.map((project, index) => {
          const barWidthPercent = getBarWidth(project.focusMinutes);
          const actualBarWidth = (barWidthPercent / 100) * barMaxWidth;
          const color = projectColors[index % projectColors.length];
          
          return (
            <Animated.View
              key={project.id}
              entering={FadeInRight.delay(700 + index * 100).duration(400)}
              style={styles.barRow}
            >
              {/* Project Icon */}
              <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
                {getProjectIcon(project.type, color)}
              </View>
              
              {/* Bar with gradient fade */}
              <View style={styles.barWrapper}>
                <View style={[styles.barBackground, { width: barMaxWidth }]}>
                  <LinearGradient
                    colors={[color, `${color}80`, `${color}20`, 'transparent']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[
                      styles.bar,
                      {
                        width: actualBarWidth,
                      },
                    ]}
                  />
                </View>
                
                {/* Project name - subtle, underneath */}
                <Text style={styles.projectName} numberOfLines={1}>
                  {project.name}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  barsContainer: {
    gap: 16,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barWrapper: {
    flex: 1,
    gap: 4,
  },
  barBackground: {
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 12,
  },
  projectName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '400',
    paddingLeft: 4,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 14,
  },
});

export default EnergyFlowBars;

