"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { OAuthButtons } from "./OAuthButton";

interface EmailStepProps {
  email: string;
  setEmail: (email: string) => void;
  isSubmitting: boolean;
  isGoogleLoading: boolean;
  setIsGoogleLoading: (loading: boolean) => void;
  onEmailSubmit: (e: React.FormEvent) => void;
}

export const EmailStep: React.FC<EmailStepProps> = ({
  email,
  setEmail,
  isSubmitting,
  isGoogleLoading,
  setIsGoogleLoading,
  onEmailSubmit,
}) => {
  return (
    <motion.div
      key="email-step"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6 text-center"
    >
      <div className="space-y-1">
        <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-foreground">
          Welcome Back
        </h1>
        <p className="text-[1.8rem] text-muted-foreground font-light">
          Sign in to continue
        </p>
      </div>

      <div className="space-y-4">
        <OAuthButtons
          isGoogleLoading={isGoogleLoading}
          setIsGoogleLoading={setIsGoogleLoading}
        />

        <div className="flex items-center gap-4">
          <div className="h-px bg-border flex-1" />
          <span className="text-muted-foreground text-sm">or</span>
          <div className="h-px bg-border flex-1" />
        </div>

        <form onSubmit={onEmailSubmit}>
          {/* Enhanced Email Input with 2FA-style border */}
          <div className="w-full">
            <div className="relative rounded-full py-4 px-5 border border-border bg-transparent">
              <div className="flex items-center justify-center">
                <input
                  type="email"
                  placeholder="meow@rdpdatacenter.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-center text-lg bg-transparent text-foreground border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
                  required
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className={`ml-3 text-foreground w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 group overflow-hidden ${
                    email.trim() && !isSubmitting
                      ? "bg-foreground/10 hover:bg-foreground/20 cursor-pointer"
                      : "bg-transparent cursor-not-allowed opacity-50"
                  }`}
                >
                  <span className="relative w-full h-full block overflow-hidden">
                    <span className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${
                      email.trim() && !isSubmitting ? "group-hover:translate-x-full" : ""
                    }`}>
                      →
                    </span>
                    <span className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${
                      email.trim() && !isSubmitting ? "-translate-x-full group-hover:translate-x-0" : "-translate-x-full"
                    }`}>
                      →
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Info section similar to 2FA step */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-500 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                Secure Login
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                We&apos;ll send a verification code to your email address
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground pt-10">
        By signing up, you agree to the{" "}
        <Link
          href="https://rdpdatacenter.in/T&Cs"
          className="underline text-muted-foreground hover:text-foreground transition-colors"
        >
          Terms
        </Link>
        ,{" "}
        <Link
          href="https://rdpdatacenter.in/Privacy"
          className="underline text-muted-foreground hover:text-foreground transition-colors"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </motion.div>
  );
};