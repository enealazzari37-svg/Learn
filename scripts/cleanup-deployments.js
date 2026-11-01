#!/usr/bin/env node
// Loescht alte Vercel-Deployments eines Projekts und behaelt die neuesten KEEP.
// Env: VERCEL_TOKEN, VERCEL_PROJECT_ID (Pflicht); VERCEL_ORG_ID (Team, optional);
//      KEEP (Standard 10); DRY_RUN=1 (nur anzeigen).
// Das aktuelle Production-Deployment wird nie geloescht, auch wenn es aelter ist.

const API = 'https://api.vercel.com';
const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_ORG_ID;
const keep = Math.max(1, parseInt(process.env.KEEP || '10', 10) || 10);
const dryRun = !!process.env.DRY_RUN;

if (!token || !projectId) {
  console.error('VERCEL_TOKEN und VERCEL_PROJECT_ID muessen gesetzt sein.');
  process.exit(1);
}

async function call(method, path, params = {}) {
  const qs = new URLSearchParams(params);
  if (teamId && teamId.startsWith('team_')) qs.set('teamId', teamId);
  const res = await fetch(`${API}${path}?${qs}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function listAll() {
  const out = [];
  let until;
  for (;;) {
    const p = { projectId, limit: '100' };
    if (until) p.until = String(until);
    const data = await call('GET', '/v6/deployments', p);
    out.push(...data.deployments);
    if (!data.pagination || !data.pagination.next) break;
    until = data.pagination.next;
  }
  return out.sort((a, b) => b.created - a.created);
}

(async () => {
  const project = await call('GET', `/v9/projects/${projectId}`);
  const prodId = project.targets && project.targets.production && project.targets.production.id;
  const all = await listAll();
  const stale = all.slice(keep).filter((d) => d.uid !== prodId);
  console.log(`${all.length} Deployments gefunden, behalte ${keep}, loesche ${stale.length}${dryRun ? ' (Dry-Run)' : ''}.`);
  let failed = 0;
  for (const d of stale) {
    const label = `${d.uid} ${d.url} (${new Date(d.created).toISOString()})`;
    if (dryRun) { console.log(`[dry-run] ${label}`); continue; }
    try {
      await call('DELETE', `/v13/deployments/${d.uid}`);
      console.log(`geloescht: ${label}`);
    } catch (e) {
      failed++;
      console.error(`Fehler bei ${label}: ${e.message}`);
    }
  }
  if (failed) process.exit(1);
})().catch((e) => { console.error(e.message); process.exit(1); });
