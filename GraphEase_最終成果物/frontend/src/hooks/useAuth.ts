"use client";

import { useState, useEffect } from "react";
import { User } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (from localStorage or session)
    const savedUser = localStorage.getItem("graphease_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Failed to parse saved user:", error);
        localStorage.removeItem("graphease_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Mock login - in real app, this would call the API
    const mockUser: User = {
      id: "1",
      name: "mitu",
      email: email,
    };
    
    setUser(mockUser);
    localStorage.setItem("graphease_user", JSON.stringify(mockUser));
  };

  const signup = async (name: string, email: string, password: string, confirmPassword: string) => {
    if (password !== confirmPassword) {
      throw new Error("パスワードが一致しません");
    }
    
    // Mock signup - in real app, this would call the API
    const mockUser: User = {
      id: "1",
      name: name,
      email: email,
    };
    
    setUser(mockUser);
    localStorage.setItem("graphease_user", JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("graphease_user");
  };

  return {
    user,
    isLoading,
    login,
    signup,
    logout,
  };
}

