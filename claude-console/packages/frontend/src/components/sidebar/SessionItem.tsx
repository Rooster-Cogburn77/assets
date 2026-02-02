import React, { useState } from 'react';
import {
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  Check,
  X,
} from 'lucide-react';
import { cn, formatRelativeTime, truncate } from '@/utils';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/common/Input';
import type { Session } from '@/types';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onArchive: () => void;
}

export const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onArchive,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);
  const [showMenu, setShowMenu] = useState(false);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(session.name);
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(session.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation? This cannot be undone.')) {
      onDelete();
    }
    setShowMenu(false);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive();
    setShowMenu(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="text-sm py-1"
        />
        <IconButton size="sm" onClick={handleSaveEdit} tooltip="Save">
          <Check size={16} className="text-green-400" />
        </IconButton>
        <IconButton size="sm" onClick={handleCancelEdit} tooltip="Cancel">
          <X size={16} className="text-red-400" />
        </IconButton>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-dark-700'
          : 'hover:bg-dark-800'
      )}
      onClick={onSelect}
    >
      {/* Icon */}
      <MessageSquare
        size={18}
        className={cn(
          'flex-shrink-0',
          isActive ? 'text-claude-orange' : 'text-dark-500'
        )}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-sm font-medium truncate',
              isActive ? 'text-dark-100' : 'text-dark-200'
            )}
          >
            {truncate(session.name, 24)}
          </span>
          <span className="flex-shrink-0 text-xs text-dark-500">
            {formatRelativeTime(session.updatedAt)}
          </span>
        </div>
        <div className="text-xs text-dark-500 truncate">
          {session.messageCount} messages
        </div>
      </div>

      {/* Menu button */}
      <div
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          showMenu && 'opacity-100'
        )}
      >
        <IconButton
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          <MoreHorizontal size={16} />
        </IconButton>

        {/* Dropdown menu */}
        {showMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />

            {/* Menu */}
            <div className="absolute right-0 top-full mt-1 z-20 bg-dark-800 border border-dark-700 rounded-lg shadow-xl py-1 min-w-[140px]">
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 transition-colors"
              >
                <Pencil size={14} />
                Rename
              </button>
              <button
                onClick={handleArchive}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 transition-colors"
              >
                <Archive size={14} />
                Archive
              </button>
              <div className="border-t border-dark-700 my-1" />
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-950/30 transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
