/**
 * Tag Management Utilities for OopsTab
 * Handles creating, storing, and managing tags for snapshots
 */

import browser from "./browserAPI";
import {
  getAllSnapshots,
  saveAllSnapshots,
  WindowEntry,
  WindowSnapshot,
} from "./snapshotManager";

// Storage key for global tag data
const TAGS_KEY = "oopsTags";

// Tag interface
export interface Tag {
  id: string; // Unique identifier for the tag (lowercase, no spaces)
  name: string; // Display name
  color: string; // Color code (hex)
  count: number; // Number of snapshots using this tag
}

// Default colors for tags
export const TAG_COLORS = [
  "#EF4444", // red
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
];

/**
 * Get all tags
 * @returns Promise resolving to all tags
 */
export const getAllTags = async (): Promise<Tag[]> => {
  const result = await browser.storage.local.get([TAGS_KEY]);
  return Array.isArray(result[TAGS_KEY]) ? result[TAGS_KEY] : [];
};

/**
 * Save all tags
 * @param tags Tags to save
 */
export const saveAllTags = async (tags: Tag[]): Promise<void> => {
  await browser.storage.local.set({ [TAGS_KEY]: tags });
};

/**
 * Create a new tag
 * @param name Display name for the tag
 * @param color Color code for the tag
 * @returns The created tag
 */
export const createTag = async (name: string, color: string): Promise<Tag> => {
  // Create tag ID - lowercase name with spaces replaced by hyphens
  const id = name.toLowerCase().replace(/\s+/g, "-");

  // Get existing tags
  const tags = await getAllTags();

  // Check if tag with this ID already exists
  if (tags.some((tag) => tag.id === id)) {
    throw new Error(`Tag "${name}" already exists`);
  }

  // Create new tag
  const newTag: Tag = {
    id,
    name,
    color,
    count: 0,
  };

  // Save updated tags
  await saveAllTags([...tags, newTag]);

  return newTag;
};

/**
 * Delete a tag
 * @param tagId ID of the tag to delete
 * @returns True if deletion was successful
 */
export const deleteTag = async (tagId: string): Promise<boolean> => {
  // Get all existing tags
  const tags = await getAllTags();
  const filteredTags = tags.filter((tag) => tag.id !== tagId);

  // If no tags were removed, return false
  if (filteredTags.length === tags.length) {
    return false;
  }

  // Save updated tags
  await saveAllTags(filteredTags);

  // Remove tag from all snapshots that have it
  const entries = await getAllSnapshots();
  let modified = false;

  for (const entry of entries) {
    for (const snapshot of entry.snapshots) {
      if (snapshot.tags && snapshot.tags.includes(tagId)) {
        snapshot.tags = snapshot.tags.filter((id) => id !== tagId);
        modified = true;
      }
    }
  }

  // If any snapshots were modified, save them
  if (modified) {
    await saveAllSnapshots(entries);
  }

  return true;
};

/**
 * Update an existing tag
 * @param tagId ID of the tag to update
 * @param updates Properties to update
 * @returns The updated tag or null if tag not found
 */
export const updateTag = async (
  tagId: string,
  updates: { name?: string; color?: string }
): Promise<Tag | null> => {
  const tags = await getAllTags();
  const tagIndex = tags.findIndex((tag) => tag.id === tagId);

  if (tagIndex === -1) {
    return null;
  }

  // Update the tag
  tags[tagIndex] = {
    ...tags[tagIndex],
    ...(updates.name && { name: updates.name }),
    ...(updates.color && { color: updates.color }),
  };

  await saveAllTags(tags);
  return tags[tagIndex];
};

/**
 * Add a tag to a snapshot
 * @param oopsWindowId Window ID containing the snapshot
 * @param timestamp Timestamp of the snapshot
 * @param tagId ID of the tag to add
 * @returns True if tag was added successfully
 */
export const addTagToSnapshot = async (
  oopsWindowId: string,
  timestamp: number,
  tagId: string
): Promise<boolean> => {
  // Verify the tag exists
  const tags = await getAllTags();
  const tagExists = tags.some((tag) => tag.id === tagId);

  if (!tagExists) {
    return false;
  }

  // Get snapshots
  const entries = await getAllSnapshots();
  const windowEntry = entries.find(
    (entry) => entry.oopsWindowId === oopsWindowId
  );

  if (!windowEntry) {
    return false;
  }

  // Find the snapshot
  const snapshot = windowEntry.snapshots.find((s) => s.timestamp === timestamp);

  if (!snapshot) {
    return false;
  }

  // Add tag if it doesn't already exist
  if (!snapshot.tags) {
    snapshot.tags = [tagId];
  } else if (!snapshot.tags.includes(tagId)) {
    snapshot.tags.push(tagId);
  } else {
    // Tag already exists on this snapshot
    return true;
  }

  // Update tag count
  const tagIndex = tags.findIndex((tag) => tag.id === tagId);
  if (tagIndex !== -1) {
    tags[tagIndex].count++;
    await saveAllTags(tags);
  }

  // Save updated snapshots
  await saveAllSnapshots(entries);

  return true;
};

/**
 * Remove a tag from a snapshot
 * @param oopsWindowId Window ID containing the snapshot
 * @param timestamp Timestamp of the snapshot
 * @param tagId ID of the tag to remove
 * @returns True if tag was removed successfully
 */
export const removeTagFromSnapshot = async (
  oopsWindowId: string,
  timestamp: number,
  tagId: string
): Promise<boolean> => {
  // Get snapshots
  const entries = await getAllSnapshots();
  const windowEntry = entries.find(
    (entry) => entry.oopsWindowId === oopsWindowId
  );

  if (!windowEntry) {
    return false;
  }

  // Find the snapshot
  const snapshot = windowEntry.snapshots.find((s) => s.timestamp === timestamp);

  if (!snapshot || !snapshot.tags || !snapshot.tags.includes(tagId)) {
    return false;
  }

  // Remove the tag
  snapshot.tags = snapshot.tags.filter((id) => id !== tagId);

  // Update tag count
  const tags = await getAllTags();
  const tagIndex = tags.findIndex((tag) => tag.id === tagId);
  if (tagIndex !== -1) {
    tags[tagIndex].count = Math.max(0, tags[tagIndex].count - 1);
    await saveAllTags(tags);
  }

  // Save updated snapshots
  await saveAllSnapshots(entries);

  return true;
};

/**
 * Get all snapshots with a specific tag
 * @param tagId ID of the tag to filter by
 * @returns Array of window entries containing snapshots with the tag
 */
export const getSnapshotsByTag = async (
  tagId: string
): Promise<WindowEntry[]> => {
  const entries = await getAllSnapshots();

  // Filter to only include entries with snapshots that have the tag
  return entries
    .map((entry) => {
      const filteredSnapshots = entry.snapshots.filter(
        (snapshot) => snapshot.tags && snapshot.tags.includes(tagId)
      );

      if (filteredSnapshots.length === 0) {
        return null;
      }

      return {
        ...entry,
        snapshots: filteredSnapshots,
      };
    })
    .filter((entry): entry is WindowEntry => entry !== null);
};

/**
 * Refresh tag counts by scanning all snapshots
 * Updates count property for each tag
 */
export const refreshTagCounts = async (): Promise<void> => {
  const entries = await getAllSnapshots();
  const tags = await getAllTags();

  // Reset all counts to zero
  tags.forEach((tag) => (tag.count = 0));

  // Count occurrences in snapshots
  for (const entry of entries) {
    for (const snapshot of entry.snapshots) {
      if (snapshot.tags) {
        for (const tagId of snapshot.tags) {
          const tagIndex = tags.findIndex((tag) => tag.id === tagId);
          if (tagIndex !== -1) {
            tags[tagIndex].count++;
          }
        }
      }
    }
  }

  // Save updated tag counts
  await saveAllTags(tags);
};
