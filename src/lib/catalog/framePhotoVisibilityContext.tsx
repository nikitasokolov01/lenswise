"use client";

import { createContext, useContext, type ReactNode } from "react";

const FramePhotoVisibilityContext = createContext(false);

export function FramePhotoVisibilityProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <FramePhotoVisibilityContext.Provider value={enabled}>
      {children}
    </FramePhotoVisibilityContext.Provider>
  );
}

/**
 * Organization-level frame-photo preference. The default is deliberately
 * false so photos never render (or trigger browser image requests) outside the
 * authenticated application shell or when the setting cannot be loaded.
 */
export function useFramePhotosEnabled(): boolean {
  return useContext(FramePhotoVisibilityContext);
}
