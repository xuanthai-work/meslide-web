import { LLMConfig } from "@/types/llm_config";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserConfigState {
  llm_config: LLMConfig
}

const initialState: UserConfigState = {
  llm_config: {
    LLM: "openai",
    IMAGE_PROVIDER: "gpt-image-1.5",

  },
}

const userConfigSlice = createSlice({
  name: "userConfig",
  initialState: initialState,
  reducers: {
    setLLMConfig: (state, action: PayloadAction<LLMConfig>) => {
      state.llm_config = action.payload;
    }
  },
});

export const { setLLMConfig } = userConfigSlice.actions;
export default userConfigSlice.reducer;
