import React, { useState, useEffect, useRef } from "react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { Tag as TagType } from "../../utils/tagManager";
import Tag from "./Tag";
import { TAG_COLORS } from "../../utils/tagManager";

interface TagSelectorProps {
  availableTags: TagType[];
  selectedTags: string[]; // Array of tag IDs
  onTagToggle: (tagId: string) => void;
  onCreateTag: (name: string, color: string) => Promise<TagType | null>;
  className?: string;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  availableTags,
  selectedTags,
  onTagToggle,
  onCreateTag,
  className = "",
}) => {
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when showing tag input
  useEffect(() => {
    if (showTagInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showTagInput]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      const newTag = await onCreateTag(newTagName.trim(), selectedColor);
      if (newTag) {
        // Auto-select the newly created tag
        onTagToggle(newTag.id);

        // Reset form
        setNewTagName("");
        setSelectedColor(
          TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
        );
        setShowTagInput(false);
      }
    } catch (error) {
      console.error("Error creating tag:", error);
      alert(error instanceof Error ? error.message : "Failed to create tag");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateTag();
    } else if (e.key === "Escape") {
      setShowTagInput(false);
      setNewTagName("");
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => (
          <Tag
            key={tag.id}
            id={tag.id}
            label={tag.name}
            color={tag.color}
            onClick={() => onTagToggle(tag.id)}
            className={
              selectedTags.includes(tag.id)
                ? "ring-2 ring-offset-1"
                : "opacity-70"
            }
          />
        ))}

        {!showTagInput && (
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setShowTagInput(true)}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Tag
          </button>
        )}
      </div>

      {showTagInput && (
        <div className="pt-2 space-y-3">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tag name"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary text-sm"
              disabled={isCreating}
            />
            <button
              type="button"
              className="py-1 px-3 bg-primary text-white rounded-md text-sm hover:bg-opacity-90 disabled:opacity-50"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              className="py-1 px-3 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-opacity-90"
              onClick={() => {
                setShowTagInput(false);
                setNewTagName("");
              }}
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Color:</span>
            <div className="flex space-x-1">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-5 h-5 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    selectedColor === color ? "ring-2 ring-offset-1" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagSelector;
