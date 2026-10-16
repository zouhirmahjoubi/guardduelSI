import { useState, useMemo, useCallback } from 'react';
import { BookOpen, Search, Copy, Check, Award, BookMarked, FlaskConical, NotebookPen, Plus, Trash2, Clock } from 'lucide-react';
import { CHEATSHEETS, CERT_TRACKS, BOOKS, LABS } from '@/data/presets';
import type { CheatSheetEntry, PentestNote, WorkspaceId } from '@/types';
import { sfx } from '@/utils/soundEngine';
import { copyToClipboard } from '@/utils/downloads';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = ['Linux', 'Network', 'OWASP Web', 'Memory/Binary', 'AI Guardrails', 'Forensics'] as const;

export function VaultWorkspace({ notes, onAddNote, onDeleteNote }: {
  notes: PentestNote[];
  onAddNote: (note: PentestNote) => void;
  onDeleteNote: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [certData, setCertData] = useState(CERT_TRACKS);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [currentWorkspace] = useState<WorkspaceId>('vault');

  const filteredCheats = useMemo(() => {
    return CHEATSHEETS.filter((c) => {
      const matchesSearch = !search ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.command.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'All' || c.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  const handleCopy = useCallback((entry: CheatSheetEntry) => {
    copyToClipboard(entry.command);
    setCopiedId(entry.id);
    sfx.success();
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const toggleTopic = (certId: string, topicIdx: number) => {
    setCertData((prev) => prev.map((c) => {
      if (c.id !== certId) return c;
      const topics = c.topics.map((t, i) => i === topicIdx ? { ...t, done: !t.done } : t);
      const level = topics.filter((t) => t.done).length;
      return { ...c, topics, level };
    }));
    sfx.toggle();
  };

  const handleAddNote = () => {
    if (!noteTitle.trim() && !noteBody.trim()) return;
    const note: PentestNote = {
      id: `note-${Date.now()}`,
      workspace: currentWorkspace,
      title: noteTitle || 'Untitled Finding',
      body: noteBody,
      timestamp: new Date().toISOString(),
    };
    onAddNote(note);
    setNoteTitle('');
    setNoteBody('');
    sfx.success();
  };

  return (
    <div className="flex h-full overflow-auto p-2 gap-2">
      {/* Left: Cheatsheet Vault */}
      <div className="flex-1 panel flex flex-col overflow-hidden min-w-0">
        <div className="panel-header">
          <BookOpen size={12} className="text-cyan-400" />
          guardduelSI Knowledge Vault
        </div>
        <div className="p-3 border-b border-obsidian-700 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-slate-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search defensive commands..."
              className="flex-1 bg-obsidian-900 border border-obsidian-700 rounded-md px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                activeCategory === 'All' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-obsidian-800 border-obsidian-700 text-slate-500'
              }`}
              onClick={() => { setActiveCategory('All'); sfx.tab(); }}
            >
              All ({CHEATSHEETS.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = CHEATSHEETS.filter((c) => c.category === cat).length;
              return (
                <button
                  key={cat}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                    activeCategory === cat ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-obsidian-800 border-obsidian-700 text-slate-500 hover:text-slate-300'
                  }`}
                  onClick={() => { setActiveCategory(cat); sfx.tab(); }}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {filteredCheats.map((entry) => (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="panel p-3 hover:border-obsidian-600 transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="badge-cyan">{entry.category}</span>
                  <span className="text-xs font-semibold text-slate-300">{entry.title}</span>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-cyan-400"
                  onClick={() => handleCopy(entry)}
                >
                  {copiedId === entry.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
              <div className="terminal p-2 text-[10px] font-mono text-emerald-400 whitespace-pre-wrap">
                {entry.command}
              </div>
              <div className="text-[10px] text-slate-600 mt-1">{entry.description}</div>
            </motion.div>
          ))}
          {filteredCheats.length === 0 && (
            <div className="text-center text-slate-600 text-xs py-8">No results for "{search}"</div>
          )}
        </div>
      </div>

      {/* Center: Certification Roadmap */}
      <div className="w-80 shrink-0 space-y-2 overflow-auto hidden lg:block">
        <div className="panel">
          <div className="panel-header">
            <Award size={12} className="text-amber-400" />
            Cert Readiness Tracker
          </div>
          <div className="p-3 space-y-3">
            {certData.map((cert) => (
              <div key={cert.id} className="panel p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">{cert.name}</span>
                  <span className={`text-[10px] font-bold ${cert.level === cert.maxLevel ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {cert.level}/{cert.maxLevel}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-obsidian-700 rounded-full mb-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                    animate={{ width: `${(cert.level / cert.maxLevel) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="space-y-1">
                  {cert.topics.map((topic, i) => (
                    <button
                      key={i}
                      className="flex items-center gap-2 w-full text-left p-1 rounded hover:bg-obsidian-800 transition-all"
                      onClick={() => toggleTopic(cert.id, i)}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                        topic.done ? 'bg-emerald-500 border-emerald-500' : 'border-obsidian-600'
                      }`}>
                        {topic.done && <Check size={9} className="text-obsidian-900" />}
                      </div>
                      <span className={`text-[10px] ${topic.done ? 'text-emerald-400 line-through' : 'text-slate-400'}`}>
                        {topic.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Books */}
        <div className="panel">
          <div className="panel-header">
            <BookMarked size={12} className="text-cyan-400" />
            Essential Books
          </div>
          <div className="p-3 space-y-2">
            {BOOKS.map((book, i) => (
              <div key={i} className="panel p-2">
                <div className="text-[10px] font-semibold text-slate-300">{book.title}</div>
                <div className="text-[9px] text-slate-600">{book.author} — {book.topic}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Labs */}
        <div className="panel">
          <div className="panel-header">
            <FlaskConical size={12} className="text-emerald-400" />
            Legal Docker/VM Sandboxes
          </div>
          <div className="p-3 space-y-2">
            {LABS.map((lab, i) => (
              <div key={i} className="panel p-2">
                <div className="text-[10px] font-semibold text-emerald-400">{lab.name}</div>
                <div className="text-[9px] text-slate-600">{lab.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Pentester's Evidence Locker */}
      <div className="w-72 shrink-0 panel flex flex-col overflow-hidden hidden xl:block">
        <div className="panel-header">
          <NotebookPen size={12} className="text-amber-400" />
          Evidence Locker
        </div>
        <div className="p-3 border-b border-obsidian-700 space-y-2 shrink-0">
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Finding title..."
            className="w-full bg-obsidian-900 border border-obsidian-700 rounded-md px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
          />
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Capture finding details, CVE refs, remediation notes..."
            className="w-full bg-obsidian-900 border border-obsidian-700 rounded-md px-2 py-1.5 text-[11px] text-slate-300 h-20 resize-none focus:outline-none focus:border-amber-500/50"
          />
          <button className="btn-amber w-full flex items-center justify-center gap-1" onClick={handleAddNote}>
            <Plus size={12} /> Log Finding
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-2">
          <AnimatePresence>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="panel p-2 group"
              >
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-semibold text-amber-400">{note.title}</span>
                  <button
                    className="text-slate-700 hover:text-crimson-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { onDeleteNote(note.id); sfx.error(); }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 whitespace-pre-wrap">{note.body}</div>
                <div className="flex items-center gap-1 text-[9px] text-slate-700 mt-1">
                  <Clock size={9} />
                  {new Date(note.timestamp).toLocaleString()}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {notes.length === 0 && (
            <div className="text-center text-slate-600 text-[10px] py-4">
              No findings logged yet. Capture evidence across all workspaces.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
