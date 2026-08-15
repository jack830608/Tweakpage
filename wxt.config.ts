import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'PG Visual Editor',
    description: 'Visually edit any page and export the changes.',
    permissions: ['storage'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: { default_title: 'PG Visual Editor' },
    web_accessible_resources: [
      { resources: ['editor-main.js'], matches: ['http://*/*', 'https://*/*'] },
    ],
  },
});
