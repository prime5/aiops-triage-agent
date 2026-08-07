import { configureStore } from "@reduxjs/toolkit";
import { triageApi } from "../api/triageApi";
import sessionReducer from "../features/session/sessionSlice";
import { actionAuditMiddleware } from "./auditMiddleware";

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    [triageApi.reducerPath]: triageApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(triageApi.middleware, actionAuditMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
