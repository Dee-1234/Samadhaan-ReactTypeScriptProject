export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'citizen' | 'municipal_agent' | 'admin';
  points: number;
  reportsCount: number;
  verificationsCount: number;
  createdAt: any; // Firestore Timestamp or ISO string
  updatedAt: any;
  savedIssues?: string[];
  hideOldReports?: boolean;
}

export interface CommunityReport {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  address: string;
  status: 'Reported' | 'Investigating' | 'In Progress' | 'Resolved';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  reporterId: string;
  reporterName: string;
  upvotes: number;
  createdAt: any;
  updatedAt: any;
}

export interface VerificationVote {
  id: string;
  userId: string;
  userName: string;
  createdAt: any;
}

export interface IssueComment {
  id: string;
  userId: string;
  userName: string;
  userRole: 'citizen' | 'municipal_agent' | 'admin';
  text: string;
  createdAt: any;
  flagged?: boolean;
  flaggedBy?: string[];
}

export interface HotspotPrediction {
  category: string;
  riskScore: number; // 0 to 100
  predictedLocation: string;
  reasoning: string;
  preventiveAction: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: 'status_change' | 'new_comment';
  title: string;
  message: string;
  reportId: string;
  reportTitle: string;
  commentId?: string;
  read: boolean;
  createdAt: any;
}
