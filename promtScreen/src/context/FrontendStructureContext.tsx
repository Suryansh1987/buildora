import { createContext, useState } from "react";
import type { ReactNode } from "react";
// 1. Define a type for the context value
type MyContextType = {
  value: Record<string, any>;
  setValue: React.Dispatch<React.SetStateAction<Record<string, any>>>;
};

// 2. Provide a default value (can be null initially)
export const MyContext = createContext<MyContextType | undefined>(undefined);

// 3. Define the props type for your provider
type MyProviderProps = {
  children: ReactNode;
};

// 4. Create the provider
export const MyContextProvider = ({ children }: MyProviderProps) => {
  const [value, setValue] = useState<Record<string, any>>({});

  return (
    <MyContext.Provider value={{ value, setValue }}>
      {children}
    </MyContext.Provider>
  );
};
