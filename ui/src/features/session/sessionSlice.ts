import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface SessionState {
  identity: string;
  token: string | null;
  mintedAt: string | null;
}

const initialState: SessionState = {
  identity: "triage-agent-readonly",
  token: null,
  mintedAt: null,
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    identityChanged(state, action: PayloadAction<string>) {
      state.identity = action.payload;
      // switching identity invalidates any previously minted token
      state.token = null;
      state.mintedAt = null;
    },
    tokenMinted(state, action: PayloadAction<string>) {
      state.token = action.payload;
      state.mintedAt = new Date().toISOString();
    },
  },
});

export const { identityChanged, tokenMinted } = sessionSlice.actions;
export default sessionSlice.reducer;
