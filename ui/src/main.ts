import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { loadConfig } from './lib/config.ts';
import { autoFullscreen } from './lib/fullscreen.ts';

autoFullscreen();

const target = document.getElementById('app')!;
target.innerHTML = '<p style="font:1rem system-ui;color:#888;text-align:center;margin-top:40vh">Connecting to bridge&hellip;</p>';

const cfg = await loadConfig((attempt) => {
  target.firstElementChild!.textContent = `Waiting for bridge\u2026 (attempt ${attempt})`;
});

target.innerHTML = '';
mount(App, { target, props: { cfg } });
