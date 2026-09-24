import type { PresentationConfig } from "@/app/(presentation-generator)/upload/type";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Local uploads and decomposed server files share this list. */
export type StoredUploadFile = {
  id?: string;
  name?: string;
  file?: File;
  size?: string;
  file_path?: string;
};

interface PresentationGenUploadState {
  config: PresentationConfig | null;
  files: StoredUploadFile[];
}

const initialState: PresentationGenUploadState = {
  config: null,
  files: [],
};

export const presentationGenUploadSlice = createSlice({
  name: "pptGenUpload",
  initialState,
  reducers: {
    setPptGenUploadState: (
      state,
      action: PayloadAction<Partial<PresentationGenUploadState>>
    ) => {
      if (action.payload.config !== undefined) {
        state.config = action.payload.config;
      }
      if (action.payload.files !== undefined) {
        state.files = action.payload.files;
      }
    },
  },
});

export const { setPptGenUploadState } = presentationGenUploadSlice.actions;
export default presentationGenUploadSlice.reducer;
