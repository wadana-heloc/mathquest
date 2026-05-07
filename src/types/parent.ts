// ─── MathQuest Parent Dashboard Types ────────────────────────────────────────

export interface Child {
  id: string;
  name: string;
  email: string;
  grade: number;
  dob: string;
  avatar?: string;
  zone: number;
  zoneName: string;
  coinBalance: number;
  lastActive: string;
  settings: ChildSettings;
  analytics: Analytics;
  tricks: TrickDiscovery[];
  sessions: Session[];
  bosses: BossCompletion[];
  stories: Story[];
  audioFiles: AudioFile[];
  weakConcepts: WeakConcept[];
}

export interface ChildSettings {
  diffCeiling: number;
  autoScaling: boolean;
  dailyLimitMins: number;
  sessionLimitMins: number;
  audioOn: boolean;
  volumeLevel: number;
}

export interface Analytics {
  last7: PeriodStats;
  last30: PeriodStats;
  dailyActivity: DailyActivity[];
}

export interface PeriodStats {
  attempted: number;
  correct: number;
  hinted: number;
  correctRate: number;
}

export interface DailyActivity {
  day: string;
  attempted: number;
  correct: number;
}

export interface TrickDiscovery {
  id: string;
  category: "A" | "B" | "C" | "D";
  name: string;
  discoveredAt: string;
}

export interface Session {
  id: string;
  date: string;
  durationMins: number;
  coinsEarned: number;
  problemsAttempted: number;
  correctRate: number;
}

export interface BossCompletion {
  id: string;
  name: string;
  zone: string;
  completedAt: string;
  coinsEarned: number;
  icon: string;
}

export interface Story {
  id: string;
  title: string;
  fullText: string;
  preview: string;
  styleNotes: string;
  generatedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface AudioFile {
  id: string;
  name: string;
  context: string;
  sizeLabel: string;
  active: boolean;
  url?: string;
}

export interface WeakConcept {
  name: string;
  errorRate: number;
  hintRate: number;
  combined: number;
}

export interface AddChildForm {
  name: string;
  email: string;
  password: string;
  grade: string;
  dob: string;
}