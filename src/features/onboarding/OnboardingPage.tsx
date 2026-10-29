import { useState } from 'react';
import { Box, Card, LinearProgress, Stack, Step, StepLabel, Stepper, Typography, useMediaQuery, useTheme } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { LogoMark } from '@/components/layout/Logo';
import { motionTokens } from '@/components/ui/motion';
import { WelcomeStep, HouseholdStep, ModulesStep, MembersStep, StarterItemsStep, DoneStep } from './steps';

const STEPS = ['Welcome', 'Household', 'Modules', 'Members', 'Starter items', 'Done'] as const;

/** First-run setup: short, skippable steps, each saved as soon as it is completed. */
export default function OnboardingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [step, setStep] = useState(0);
  const next = () => setStep((value) => Math.min(value + 1, STEPS.length - 1));

  return (
    <Box component="main" sx={{ minHeight: '100dvh', bgcolor: 'background.default', px: 2, py: { xs: 3, md: 6 } }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 3 }}>
          <LogoMark size={32} />
          <Typography sx={{ fontWeight: 800, fontSize: '1.0625rem' }}>HomeHub</Typography>
        </Stack>

        {isMobile ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={((step + 1) / STEPS.length) * 100}
              sx={{ mt: 0.75 }}
              aria-label="Setup progress"
            />
          </Box>
        ) : (
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        )}

        <Card sx={{ p: { xs: 2.5, sm: 4 }, overflow: 'hidden' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={motionTokens.base}
            >
              {step === 0 && <WelcomeStep onContinue={next} />}
              {step === 1 && <HouseholdStep onCreated={next} />}
              {step === 2 && <ModulesStep onDone={next} />}
              {step === 3 && <MembersStep onDone={next} />}
              {step === 4 && <StarterItemsStep onDone={next} />}
              {step === 5 && <DoneStep />}
            </motion.div>
          </AnimatePresence>
        </Card>
      </Box>
    </Box>
  );
}
