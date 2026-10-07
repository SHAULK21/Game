import React, { createContext, useContext } from "react";
import { useGameModel, type GameContextType } from "../game/GameModel";
import { RemoteGameProvider } from "./RemoteGameProvider";
export type { GameContextType } from "../game/GameModel";
const GameContext = createContext<GameContextType | undefined>(undefined);
export const LocalGameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <GameContext.Provider value={useGameModel()}>{children}</GameContext.Provider>
);
export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <RemoteGameProvider context={GameContext}>{children}</RemoteGameProvider>;

export type CloudGameContextType = {
  [K in keyof GameContextType]: K extends "createCharacter"
    ? (
        ...args: Parameters<GameContextType["createCharacter"]>
      ) => Promise<boolean>
    : K extends
          | "getInterfaceSwitchBlockReason"
          | "commitSwitchSnapshot"
          | "flushProgress"
      ? GameContextType[K]
      : GameContextType[K] extends (...args: infer A) => infer R
        ? R extends void
          ? (...args: A) => void
          : (...args: A) => Promise<Awaited<R>>
        : GameContextType[K];
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context as unknown as CloudGameContextType;
};
