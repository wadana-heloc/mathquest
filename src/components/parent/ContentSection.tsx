"use client";
import { useState } from "react";
import type { Story } from "@/types/parent";

interface Props {
  stories: Story[];
  onUpdateStory: (id: string, status: Story["status"], editedText?: string) => void;
}

const STATUS_STYLE: Record<Story["status"], { bg: string; text: string; dot: string; label: string }> = {
  pending:  { bg: "bg-gold/12",       text: "text-yellow-700", dot: "bg-gold",       label: "Pending"  },
  approved: { bg: "bg-game-green/10", text: "text-green-700",  dot: "bg-game-green", label: "Approved" },
  rejected: { bg: "bg-border/60",     text: "text-text-muted", dot: "bg-text-muted", label: "Rejected" },
};

export default function ContentSection({ stories, onUpdateStory }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [filter, setFilter] = useState<Story["status"] | "all">("all");

  const filtered = filter === "all" ? stories : stories.filter((s) => s.status === filter);
  const pending = stories.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-800 text-primary text-sm sm:text-base">
            Content Approval Queue
          </h3>
          {pending > 0 && (
            <span className="w-5 h-5 rounded-full bg-coral text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {pending}
            </span>
          )}
        </div>
        {/* Filter tabs — scrollable on very small screens */}
        <div className="flex gap-1 bg-bg border border-border rounded-lg p-1 overflow-x-auto flex-shrink-0">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                filter === f
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-primary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-10 sm:p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <div className="font-display font-800 text-primary text-sm">No stories here</div>
          <div className="text-xs text-text-muted mt-1">
            Stories generated during gameplay will appear for your review
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((story) => {
            const ss = STATUS_STYLE[story.status];
            const isExpanded = expanded === story.id;
            const isEditing = editing === story.id;

            return (
              <div
                key={story.id}
                className="bg-white rounded-xl border border-border overflow-hidden transition-all"
              >
                {/* Card header — tap to expand */}
                <div
                  className="flex items-center gap-3 p-3.5 sm:p-4 cursor-pointer hover:bg-bg/50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : story.id)}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ss.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-display font-800 text-primary text-sm truncate">
                        {story.title}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ss.bg} ${ss.text}`}
                      >
                        {ss.label}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted truncate">{story.preview}</p>
                  </div>
                  <div className="hidden sm:block text-right flex-shrink-0 ml-2">
                    <div className="text-[10px] text-text-muted">{story.generatedAt}</div>
                    <div className="text-[10px] text-text-muted/70 mt-0.5">
                      {story.styleNotes.split(",")[0]}
                    </div>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 16 16" fill="none"
                    stroke="#6B6A66" strokeWidth="2"
                    className={`flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="M3 6l5 5 5-5" />
                  </svg>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-border px-3.5 sm:px-4 pb-4 pt-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                      <div className="text-[11px] text-text-muted">
                        <span className="font-semibold text-primary">Style: </span>
                        {story.styleNotes}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        <span className="font-semibold text-primary">Generated: </span>
                        {story.generatedAt}
                      </div>
                    </div>

                    {isEditing ? (
                      <textarea
                        aria-label="story text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full h-32 p-3 rounded-lg border border-gold bg-gold/5 text-sm text-primary resize-none outline-none leading-relaxed"
                      />
                    ) : (
                      <div className="bg-bg rounded-lg p-3.5 text-sm text-primary leading-relaxed">
                        {story.fullText}
                      </div>
                    )}

                    {/* Actions — wrap on small screens */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {story.status !== "approved" && !isEditing && (
                        <button
                          onClick={() => onUpdateStory(story.id, "approved")}
                          className="px-3.5 h-8 rounded-lg bg-game-green/15 text-green-700 text-xs font-semibold hover:bg-game-green/25 transition-colors"
                        >
                          ✓ Approve
                        </button>
                      )}
                      {!isEditing ? (
                        <button
                          onClick={() => { setEditing(story.id); setEditText(story.fullText); }}
                          className="px-3.5 h-8 rounded-lg bg-gold/12 text-yellow-700 text-xs font-semibold hover:bg-gold/20 transition-colors"
                        >
                          ✏️ Edit & Approve
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => { onUpdateStory(story.id, "approved", editText); setEditing(null); }}
                            className="px-3.5 h-8 rounded-lg bg-game-green/15 text-green-700 text-xs font-semibold hover:bg-game-green/25 transition-colors"
                          >
                            ✓ Save & Approve
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="px-3.5 h-8 rounded-lg bg-bg border border-border text-text-muted text-xs font-semibold"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {story.status !== "rejected" && !isEditing && (
                        <button
                          onClick={() => onUpdateStory(story.id, "rejected")}
                          className="px-3.5 h-8 rounded-lg text-text-muted text-xs font-semibold hover:bg-bg transition-colors sm:ml-auto"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}