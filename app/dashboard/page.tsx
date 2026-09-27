'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

export default function DashboardPage() {
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [activeProject, setActiveProject] = useState({
    id: 'proj_demo',
    name: 'Demo SaaS App',
    slug: 'demo-app',
    repo_name: 'acme/demo-app',
  });

  const [repoInput, setRepoInput] = useState('');
  const [repoError, setRepoError] = useState('');
  const [connectedRepos, setConnectedRepos] = useState<string[]>(['acme/demo-app']);

  // Unreleased PR Queue
  const [unreleasedPRs, setUnreleasedPRs] = useState<any[]>([
    {
      pr_number: 42,
      title: 'feat: add instant changelog search and category filtering',
      author: 'developer-jane',
      status: 'unreleased',
      is_noise: false,
    },
    {
      pr_number: 43,
      title: 'fix: resolve mobile navigation backdrop blur clipping',
      author: 'alex-dev',
      status: 'unreleased',
      is_noise: false,
    },
    {
      pr_number: 44,
      title: 'chore(deps): bump tailwindcss from 3.4.1 to 3.4.2 [skip]',
      author: 'dependabot',
      status: 'filtered',
      is_noise: true,
    },
  ]);

  // Release Draft Editor State
  const [isGenerating, setIsGenerating] = useState(false);
  const [versionTag, setVersionTag] = useState('v1.4.0');
  const [releaseTitle, setReleaseTitle] = useState('v1.4.0 — Instant Search & Mobile Navigation');
  const [overviewSummary, setOverviewSummary] = useState(
    'We are excited to launch instant client-side search across all release notes, alongside major mobile layout improvements.'
  );
  const [featuresText, setFeaturesText] = useState('• Instant Changelog Search: Real-time fuzzy filtering in widget and portal.');
  const [fixesText, setFixesText] = useState('• Mobile Nav Blur: Fixed backdrop clipping on small mobile viewports.');
  const [isPublished, setIsPublished] = useState(false);

  // Copy Feedback
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const handleConnectRepo = (e: React.FormEvent) => {
    e.preventDefault();
    setRepoError('');
    if (!repoInput.includes('/')) {
      setRepoError('Repository name must follow owner/repo format');
      return;
    }
    if (tier === 'free' && connectedRepos.length >= 1) {
      setRepoError('Free tier is limited to 1 connected repository. Upgrade to Pro for unlimited repos.');
      return;
    }
    setConnectedRepos([...connectedRepos, repoInput.trim()]);
    setRepoInput('');
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    // Simulate AI synthesis latency
    setTimeout(() => {
      setReleaseTitle(`${versionTag} — Instant Search & Mobile Polishing`);
      setOverviewSummary(
        'This release introduces instant client-side release filtering and fixes navigation backdrop clipping on iOS.'
      );
      setFeaturesText('• Search & Filter: Instant client-side fuzzy search across all notes.');
      setFixesText('• Backdrop Blur: Resolved navigation blur clipping on mobile Safari.');
      setIsGenerating(false);
    }, 600);
  };

  const handlePublish = () => {
    setIsPublished(true);
    // Mark unreleased items as released
    setUnreleasedPRs(
      unreleasedPRs.map((pr) => (pr.status === 'unreleased' ? { ...pr, status: 'released' } : pr))
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(`${label} copied to clipboard!`);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const emailDraft = `Subject: Updates live: ${releaseTitle}

Hey everyone,

${overviewSummary}

### What is New:
${featuresText}

### Bug Fixes:
${fixesText}

Read more on our changelog: https://shiplog.dev/c/${activeProject.slug}

Best,
The Team`;

  const twitterThread = [
    `1/2 🚀 ShipLog ${versionTag} is live!\n\n${overviewSummary}`,
    `2/2 📦 Key changes:\n${featuresText}\n${fixesText}\n\nCheck out the full release: https://shiplog.dev/c/${activeProject.slug}`,
  ].join('\n\n---\n\n');

  const widgetSnippet = `<script defer src="https://shiplog.dev/widget.js" data-project="${activeProject.slug}"></script>`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Navbar */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">ShipLog Dashboard</h1>
              <Badge variant={tier === 'pro' ? 'default' : 'secondary'} className="uppercase text-xs font-semibold">
                {tier} Plan
              </Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Active Project: <span className="font-semibold text-slate-700 dark:text-slate-200">{activeProject.name}</span> ({activeProject.repo_name})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/c/${activeProject.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View Public Changelog ↗
            </a>
            {tier === 'free' ? (
              <Button size="sm" onClick={() => setTier('pro')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium">
                Upgrade to Pro ($15/mo)
              </Button>
            ) : (
              <Badge variant="outline" className="text-emerald-600 border-emerald-500 font-medium">
                Pro Active (White-Labeled)
              </Badge>
            )}
          </div>
        </header>

        {copyFeedback && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg text-sm text-center font-medium animate-in fade-in">
            ✓ {copyFeedback}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Repository & Ingestion Queue */}
          <div className="space-y-6">
            {/* Connected Repositories Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Connected Repositories</CardTitle>
                <CardDescription>
                  Read-only webhooks ingest merged PRs automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {connectedRepos.map((repo, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-md text-sm font-mono"
                    >
                      <span>{repo}</span>
                      <Badge variant="outline" className="text-xs">Active</Badge>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleConnectRepo} className="space-y-2 pt-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="owner/repo-name"
                      value={repoInput}
                      onChange={(e) => setRepoInput(e.target.value)}
                      className="text-sm font-mono"
                    />
                    <Button type="submit" size="sm">Connect</Button>
                  </div>
                  {repoError && <p className="text-xs text-rose-500 font-medium">{repoError}</p>}
                </form>
              </CardContent>
            </Card>

            {/* Unreleased PR Queue Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Unreleased PR Queue</CardTitle>
                  <CardDescription>Staged pull requests for next release</CardDescription>
                </div>
                <Badge variant="secondary">{unreleasedPRs.filter(p => p.status === 'unreleased').length} pending</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {unreleasedPRs.map((pr) => (
                  <div
                    key={pr.pr_number}
                    className={`p-3 rounded-lg border text-sm space-y-1 ${
                      pr.is_noise
                        ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 opacity-60'
                        : 'border-blue-100 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                        #{pr.pr_number} by @{pr.author}
                      </span>
                      <Badge variant={pr.is_noise ? 'outline' : 'default'} className="text-[10px] uppercase">
                        {pr.status}
                      </Badge>
                    </div>
                    <p className="font-medium text-xs leading-snug">{pr.title}</p>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleGenerateAI}
                  disabled={isGenerating}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {isGenerating ? 'Synthesizing with Gemini...' : '✨ Generate Release with Gemini'}
                </Button>
              </CardFooter>
            </Card>

            {/* Embeddable In-App Widget Snippet */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">In-App Widget (&lt; 5 KB)</CardTitle>
                <CardDescription>
                  Embed a notification bell & slide-out drawer into your SaaS.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-slate-900 text-slate-100 rounded-md font-mono text-xs overflow-x-auto break-all">
                  {widgetSnippet}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(widgetSnippet, 'Widget script')}
                  className="w-full text-xs"
                >
                  Copy Widget Embed Code
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (2 cols): Inline Markdown Release Editor & Publishing */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle className="text-xl">Release Draft & Publishing</CardTitle>
                    <CardDescription>Review and polish before publishing live</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Tag:</span>
                    <Input
                      value={versionTag}
                      onChange={(e) => setVersionTag(e.target.value)}
                      className="w-24 h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <Tabs defaultValue="edit" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="edit">Editor</TabsTrigger>
                    <TabsTrigger value="preview">Live Preview</TabsTrigger>
                    <TabsTrigger value="syndicate">Syndication (Email & X)</TabsTrigger>
                  </TabsList>

                  <TabsContent value="edit" className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Release Title
                      </label>
                      <Input
                        value={releaseTitle}
                        onChange={(e) => setReleaseTitle(e.target.value)}
                        className="font-semibold text-base"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Overview Summary
                      </label>
                      <Textarea
                        value={overviewSummary}
                        onChange={(e) => setOverviewSummary(e.target.value)}
                        rows={3}
                        className="text-sm leading-relaxed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                        🚀 Features
                      </label>
                      <Textarea
                        value={featuresText}
                        onChange={(e) => setFeaturesText(e.target.value)}
                        rows={2}
                        className="text-sm font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                        🛠️ Fixes & Polish
                      </label>
                      <Textarea
                        value={fixesText}
                        onChange={(e) => setFixesText(e.target.value)}
                        rows={2}
                        className="text-sm font-mono"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="p-6 border rounded-lg bg-white dark:bg-slate-900 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-blue-600">{versionTag}</Badge>
                      <span className="text-xs text-slate-400">• Just now</span>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight">{releaseTitle}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{overviewSummary}</p>
                    <Separator />
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Features</span>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line">{featuresText}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Fixes</span>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line">{fixesText}</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="syndicate" className="space-y-6">
                    {/* Plain Text Email Draft */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Email Newsletter Draft
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(emailDraft, 'Email draft')}
                          className="h-7 text-xs font-medium text-blue-600"
                        >
                          📋 Copy Email
                        </Button>
                      </div>
                      <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-md font-mono text-xs whitespace-pre-wrap leading-relaxed">
                        {emailDraft}
                      </div>
                    </div>

                    {/* Social Post Thread */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          X (Twitter) Thread
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(twitterThread, 'Twitter thread')}
                          className="h-7 text-xs font-medium text-blue-600"
                        >
                          📋 Copy Thread
                        </Button>
                      </div>
                      <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-md font-mono text-xs whitespace-pre-wrap leading-relaxed">
                        {twitterThread}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>

              <CardFooter className="flex justify-between items-center border-t pt-4">
                <span className="text-xs text-slate-500">
                  {isPublished ? 'Status: Published Live' : 'Status: Draft'}
                </span>
                <Button
                  onClick={handlePublish}
                  disabled={isPublished}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  {isPublished ? '✓ Published to Portal & Widget' : '🚀 1-Click Publish Release'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
