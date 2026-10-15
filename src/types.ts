export type JournalArticle = {
  id: number;
  slug: string;
  number: string;
  title: string;
  dek: string;
  date: string;
  read: string;
  systems: string[];
  severity: 'High' | 'Material' | 'Watch';
  finding: string;
  body: string[];
  published: boolean;
  sortOrder: number;
  language?: string;
  targetMarkets?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type Lead = {
  id: number;
  briefToken: string;
  name: string;
  email: string;
  company: string;
  role: string;
  context: string;
  originMarket?: string;
  originDomain?: string;
  status: 'new' | 'brief_sent' | 'brief_completed' | 'jira_created';
  briefData?: any;
  pdfPath?: string;
  jiraProjectKey?: string;
  jiraEpicKey?: string;
  jiraEpicUrl?: string;
  createdAt: string;
  updatedAt: string;
};
