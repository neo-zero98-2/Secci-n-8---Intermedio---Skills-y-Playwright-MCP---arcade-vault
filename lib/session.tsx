"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type SessionUser = { name: string };

type SavedScore = { game: string; score: number; name: string; at: number };

type SessionContextValue = {
  user: SessionUser | null;
  login: (u: SessionUser | null) => void; // null = invitado
  logout: () => void;
  saveScore: (entry: { game: string; score: number; name: string }) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    // Sincroniza con localStorage (sistema externo, solo disponible en cliente).
    try {
      const raw = localStorage.getItem("av_user");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(raw ? JSON.parse(raw) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const login = (u: SessionUser | null) => {
    setUser(u);
    try {
      localStorage.setItem("av_user", JSON.stringify(u));
    } catch {
      // localStorage no disponible; la sesión sigue en memoria
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("av_user");
    } catch {
      // localStorage no disponible
    }
  };

  const saveScore = (entry: { game: string; score: number; name: string }) => {
    try {
      const all: SavedScore[] = JSON.parse(localStorage.getItem("av_scores") || "[]");
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem("av_scores", JSON.stringify(all));
    } catch {
      // localStorage no disponible; el puntaje no se persiste
    }
  };

  return (
    <SessionContext.Provider value={{ user, login, logout, saveScore }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de un SessionProvider");
  }
  return ctx;
}
