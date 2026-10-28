/**
 * LINHA DO TEMPO DE ETAPAS (28/10/2026) — mesma API do Stepper do shadcn
 * (Stepper › StepperItem › StepperTrigger › StepperIndicator/Title/Description
 * › StepperSeparator), refeita com as cores e os ícones do app, sem lucide nem
 * radix. Os passos contam a partir de 0 (o círculo mostra step + 1). A etapa ATUAL ganha uma aura girando em volta do círculo
 * (`.aura-etapa` no index.css); as concluídas ficam verdes com um check.
 */
import * as React from "react";
import { createContext, useContext } from "react";
import { cx } from "@/lib/format";
import { IcCheck } from "@/components/icons";

type StepState = "active" | "completed" | "inactive";

type StepperContextValue = {
  activeStep: number;
  setActiveStep: (step: number) => void;
  orientation: "horizontal" | "vertical";
};

type StepItemContextValue = {
  step: number;
  state: StepState;
  isDisabled: boolean;
};

const StepperContext = createContext<StepperContextValue | undefined>(undefined);
const StepItemContext = createContext<StepItemContextValue | undefined>(undefined);

function useStepper() {
  const ctx = useContext(StepperContext);
  if (!ctx) throw new Error("useStepper precisa estar dentro de um Stepper");
  return ctx;
}

function useStepItem() {
  const ctx = useContext(StepItemContext);
  if (!ctx) throw new Error("useStepItem precisa estar dentro de um StepperItem");
  return ctx;
}

interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  orientation?: "horizontal" | "vertical";
}

export function Stepper({ defaultValue = 0, value, onValueChange, orientation = "horizontal", className, ...props }: StepperProps) {
  const [interno, setInterno] = React.useState(defaultValue);
  const setActiveStep = React.useCallback(
    (step: number) => {
      if (value === undefined) setInterno(step);
      onValueChange?.(step);
    },
    [value, onValueChange],
  );
  return (
    <StepperContext.Provider value={{ activeStep: value ?? interno, setActiveStep, orientation }}>
      <div
        className={cx(
          "group/stepper inline-flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
          className,
        )}
        data-orientation={orientation}
        {...props}
      />
    </StepperContext.Provider>
  );
}

interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number;
  completed?: boolean;
  disabled?: boolean;
}

export function StepperItem({ step, completed = false, disabled = false, className, children, ...props }: StepperItemProps) {
  const { activeStep } = useStepper();
  const state: StepState = completed || step < activeStep ? "completed" : step === activeStep ? "active" : "inactive";
  return (
    <StepItemContext.Provider value={{ step, state, isDisabled: disabled }}>
      <div
        className={cx(
          "group/step flex items-center group-data-[orientation=horizontal]/stepper:flex-row group-data-[orientation=vertical]/stepper:flex-col",
          className,
        )}
        data-state={state}
        aria-current={state === "active" ? "step" : undefined}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  );
}

interface StepperTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Sem clique: renderiza um bloco comum (a etapa só é mostrada, não escolhida). */
  asChild?: boolean;
}

export function StepperTrigger({ asChild = false, className, children, ...props }: StepperTriggerProps) {
  const { setActiveStep } = useStepper();
  const { step, isDisabled } = useStepItem();
  if (asChild) return <div className={cx("inline-flex items-center gap-3", className)}>{children}</div>;
  return (
    <button
      type="button"
      className={cx("inline-flex items-center gap-3 disabled:pointer-events-none disabled:opacity-50", className)}
      onClick={() => setActiveStep(step)}
      disabled={isDisabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function StepperIndicator({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { state, step } = useStepItem();
  return (
    <div
      className={cx(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold transition-colors",
        state === "active" && "aura-etapa bg-primary text-white",
        state === "completed" && "bg-success text-white",
        state === "inactive" && "bg-[#EEF0F3] text-ink-3",
        className,
      )}
      data-state={state}
      {...props}
    >
      {children ?? (state === "completed" ? <IcCheck width={16} height={16} strokeWidth={3} aria-hidden="true" /> : <span>{step + 1}</span>)}
    </div>
  );
}

export function StepperTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cx("text-[12.5px] font-extrabold text-ink group-data-[state=inactive]/step:text-ink-3", className)} {...props} />;
}

export function StepperDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("text-[11.5px] text-ink-3", className)} {...props} />;
}

export function StepperSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "m-0.5 rounded-full bg-[#E3E6EB] group-data-[orientation=horizontal]/stepper:h-[3px] group-data-[orientation=vertical]/stepper:h-12 group-data-[orientation=horizontal]/stepper:w-full group-data-[orientation=vertical]/stepper:w-[3px] group-data-[orientation=horizontal]/stepper:flex-1 group-data-[state=completed]/step:bg-success",
        className,
      )}
      {...props}
    />
  );
}
