/**
 * Message Types for OopsTab
 * Contains all types related to messages between UI components and background script
 */

// Base message interface
export interface BaseMessage {
  type: string;
  requestId?: string; // For tracking request/response pairs
}

// Window Management Messages
export interface CreateSnapshotMessage extends BaseMessage {
  type: "CREATE_SNAPSHOT";
  windowId: number;
}

export interface GetSnapshotMessage extends BaseMessage {
  type: "GET_SNAPSHOT";
  oopsWindowId: string;
}

export interface DeleteSnapshotMessage extends BaseMessage {
  type: "DELETE_SNAPSHOT";
  oopsWindowId: string;
}

export interface RenameSnapshotMessage extends BaseMessage {
  type: "RENAME_SNAPSHOT";
  oopsWindowId: string;
  newName: string;
}

export interface ToggleStarMessage extends BaseMessage {
  type: "TOGGLE_STAR";
  oopsWindowId: string;
  isStarred: boolean;
}

// Response Messages
export interface SuccessResponse extends BaseMessage {
  type: "SUCCESS";
  requestId: string;
  data?: any;
}

export interface ErrorResponse extends BaseMessage {
  type: "ERROR";
  requestId: string;
  error: string;
  details?: any;
}

// Union type of all message types
export type Message =
  | CreateSnapshotMessage
  | GetSnapshotMessage
  | DeleteSnapshotMessage
  | RenameSnapshotMessage
  | ToggleStarMessage
  | SuccessResponse
  | ErrorResponse;
