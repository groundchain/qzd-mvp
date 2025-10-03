import type { DefaultTheme, UserConfig } from 'vitepress';

const sidebar: DefaultTheme.Sidebar = [
  {
    text: 'Overview',
    items: [
      { text: 'Introduction', link: '/' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Goals & Gap Analysis', link: '/qzd-goals-and-gap-analysis' },
      { text: 'Deployment (Single Server)', link: '/deployment-single-server' },
      { text: 'Operations Runbook', link: '/runbook' },
    ],
  },
  {
    text: 'Manuals',
    collapsed: false,
    items: [
      { text: 'Wallet User Manual', link: '/manuals/wallet-user' },
      { text: 'Admin Operator Manual', link: '/manuals/admin-operator' },
      { text: 'Merchant Operator Manual', link: '/manuals/merchant-operator' },
      { text: 'SMS Operator Manual', link: '/manuals/sms-operator' },
    ],
  },
  {
    text: 'Contributing & API',
    items: [
      { text: 'Contributor Guide', link: '/contrib' },
      { text: 'API Overview', link: '/api-readme' },
    ],
  },
];

const config: UserConfig = {
  title: 'QZD MVP Docs',
  description: 'Documentation for the QZD MVP platform, covering architecture, operations, and API usage.',
  base: '/qzd-mvp/',
  lastUpdated: true,
  ignoreDeadLinks: [
    /^https?:\/\/localhost(?::\d+)?(?:\/|$)/,
    /^https?:\/\/qzd\.example\.com\//,
  ],
  sitemap: {
    hostname: 'https://groundchain.github.io/qzd-mvp',
  },
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/architecture' },
      { text: 'API', link: '/api-readme' },
    ],
    sidebar,
    search: {
      provider: 'local',
    },
    outline: 'deep',
  },
};

export default config;
