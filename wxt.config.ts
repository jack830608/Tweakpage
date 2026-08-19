import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tweakpage',
    default_locale: 'en',
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    description:
      'Visually edit any web page, compare before and after, and hand engineers a clear list of what to change.',
    permissions: ['storage', 'downloads'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Tweakpage',
      default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    },
    web_accessible_resources: [
      { resources: ['editor-main.js'], matches: ['http://*/*', 'https://*/*'] },
    ],
  },
});
