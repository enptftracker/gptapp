import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MarketDataService } from "@/lib/marketData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const settingsSchema = z.object({
  base_currency: z.string().min(1, "Please select a base currency"),
  timezone: z.string().min(1, "Please select a timezone"),
  default_lot_method: z.enum(['FIFO', 'LIFO', 'HIFO', 'AVERAGE']),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const passwordSchema = z.object({
  current_password: z.string().min(8, 'Current password must be at least 8 characters'),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[A-Z])(?=.*\d)/, 'Use at least one uppercase letter and one number'),
  confirm_password: z.string().min(8, 'Please confirm your new password'),
}).refine((data) => data.new_password === data.confirm_password, {
  path: ['confirm_password'],
  message: 'Passwords do not match',
}).refine((data) => data.current_password !== data.new_password, {
  path: ['new_password'],
  message: 'New password must differ from the current password',
});

type PasswordFormData = z.infer<typeof passwordSchema>;

const emailSchema = z.object({
  new_email: z.string().email('Please provide a valid email address'),
  confirm_email: z.string().email('Please confirm your email address'),
  current_password: z.string().min(8, 'Current password must be at least 8 characters'),
}).refine((data) => data.new_email === data.confirm_email, {
  path: ['confirm_email'],
  message: 'Email addresses do not match',
});

type EmailFormData = z.infer<typeof emailSchema>;

type TotpFactor = {
  id: string;
  factor_type: 'totp' | string;
  status: 'verified' | 'unverified' | 'pending' | string;
  friendly_name?: string | null;
};

const currencies = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
  { value: 'AUD', label: 'Australian Dollar (AUD)' },
  { value: 'CHF', label: 'Swiss Franc (CHF)' },
  { value: 'CNY', label: 'Chinese Yuan (CNY)' },
];

const timezones = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'GMT (Greenwich Mean Time)' },
  { value: 'Europe/Berlin', label: 'CET (Central European Time)' },
  { value: 'Asia/Tokyo', label: 'JST (Japan Standard Time)' },
  { value: 'Asia/Shanghai', label: 'CST (China Standard Time)' },
  { value: 'Australia/Sydney', label: 'AEST (Australian Eastern Standard Time)' },
];

const lotMethods = [
  {
    value: 'FIFO',
    label: 'FIFO (First In, First Out)',
    description: 'Sell the oldest shares first. Generally most tax efficient for long-term positions.'
  },
  { 
    value: 'LIFO', 
    label: 'LIFO (Last In, First Out)',
    description: 'Sell the newest shares first. Can be useful for tax loss harvesting.'
  },
  { 
    value: 'HIFO', 
    label: 'HIFO (Highest In, First Out)',
    description: 'Sell shares with the highest cost basis first to minimize gains.'
  },
  { 
    value: 'AVERAGE', 
    label: 'Average Cost',
    description: 'Use the average cost of all shares. Simpler but less tax optimization.'
  },
];

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isLoadingMfa, setIsLoadingMfa] = useState(true);
  const [isEnrollingTotp, setIsEnrollingTotp] = useState(false);
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);
  const [isDisablingTotp, setIsDisablingTotp] = useState(false);
  const [isCancelingTotp, setIsCancelingTotp] = useState(false);
  const [totpFactors, setTotpFactors] = useState<TotpFactor[]>([]);
  const [enrollmentData, setEnrollmentData] = useState<{ id: string; qr_code: string; secret: string } | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [isMfaSupported, setIsMfaSupported] = useState(true);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      base_currency: 'USD',
      timezone: 'UTC',
      default_lot_method: 'FIFO',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      new_email: '',
      confirm_email: '',
      current_password: '',
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      form.reset({
        base_currency: profile.base_currency,
        timezone: profile.timezone,
        default_lot_method: profile.default_lot_method,
      });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MarketDataService.PROVIDER_STORAGE_KEY, profile.market_data_provider);
      }
    }
  }, [profile, form]);

  const onSubmit = async (data: SettingsFormData) => {
    const updatedProfile = await updateProfile.mutateAsync(data);
    const provider = updatedProfile?.market_data_provider ?? profile?.market_data_provider;
    if (typeof window !== 'undefined' && provider) {
      window.localStorage.setItem(MarketDataService.PROVIDER_STORAGE_KEY, provider);
    }
  };

  const fetchTotpFactors = useCallback(async () => {
    try {
      setIsLoadingMfa(true);
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        throw error;
      }
      setTotpFactors((data?.factors as TotpFactor[]) ?? []);
      setIsMfaSupported(true);
    } catch (error) {
      const maybeMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message
            : '';
      const normalizedMessage = maybeMessage.toLowerCase();
      const mfaUnavailable =
        normalizedMessage.includes('mfa') &&
        (normalizedMessage.includes('not enabled') ||
          normalizedMessage.includes('not supported') ||
          normalizedMessage.includes('disabled'));

      if (mfaUnavailable) {
        setIsMfaSupported(false);
        setTotpFactors([]);
        return;
      }

      const message = error instanceof Error ? error.message : t('settings.twoFactorLoadFailedDesc');
      toast({
        title: t('settings.twoFactorLoadFailed'),
        description: message,
        variant: 'destructive',
      });
      setTotpFactors([]);
    } finally {
      setIsLoadingMfa(false);
    }
  }, [t, toast]);

  useEffect(() => {
    if (!isMfaSupported) {
      setIsLoadingMfa(false);
      return;
    }
    fetchTotpFactors();
  }, [fetchTotpFactors, isMfaSupported]);

  const verifiedTotpFactor = useMemo(
    () => totpFactors.find((factor) => factor.factor_type === 'totp' && factor.status === 'verified') ?? null,
    [totpFactors]
  );

  const handleEmailSubmit = emailForm.handleSubmit(async (values) => {
    try {
      setIsUpdatingEmail(true);

      const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !sessionData?.user?.email) {
        throw new Error(t('settings.emailUpdateFailedDesc'));
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: sessionData.user.email,
        password: values.current_password,
      });

      if (reauthError) {
        emailForm.setError('current_password', {
          type: 'manual',
          message: t('settings.currentPasswordIncorrect'),
        });
        throw new Error(t('settings.currentPasswordIncorrect'));
      }

      const { error: updateError } = await supabase.auth.updateUser({ email: values.new_email });
      if (updateError) {
        throw updateError;
      }

      toast({
        title: t('settings.emailUpdated'),
        description: t('settings.emailUpdatedDesc'),
      });
      emailForm.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.emailUpdateFailedDesc');
      toast({
        title: t('settings.emailUpdateFailed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  });

  const handleStartTotpEnrollment = async () => {
    try {
      setIsEnrollingTotp(true);
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error || !data?.totp?.qr_code || !data?.totp?.secret || !data?.id) {
        throw error ?? new Error(t('settings.twoFactorEnableFailedDesc'));
      }

      setEnrollmentData({ id: data.id, qr_code: data.totp.qr_code, secret: data.totp.secret });

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: data.id });
      if (challengeError || !challengeData?.id) {
        throw challengeError ?? new Error(t('settings.twoFactorEnableFailedDesc'));
      }
      setChallengeId(challengeData.id);
      setTotpCode('');
      toast({
        title: t('settings.twoFactorEnrolling'),
        description: t('settings.twoFactorEnrollingDesc'),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.twoFactorEnableFailedDesc');
      toast({
        title: t('settings.twoFactorEnableFailed'),
        description: message,
        variant: 'destructive',
      });
      setEnrollmentData(null);
      setChallengeId(null);
    } finally {
      setIsEnrollingTotp(false);
    }
  };

  const handleCancelTotpEnrollment = async () => {
    if (!enrollmentData?.id) {
      setEnrollmentData(null);
      setChallengeId(null);
      setTotpCode('');
      return;
    }

    try {
      setIsCancelingTotp(true);
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enrollmentData.id });
      if (error) {
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.twoFactorCancelFailedDesc');
      toast({
        title: t('settings.twoFactorCancelFailed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setEnrollmentData(null);
      setChallengeId(null);
      setTotpCode('');
      await fetchTotpFactors();
      setIsCancelingTotp(false);
    }
  };

  const handleVerifyTotp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!enrollmentData?.id || !challengeId || !totpCode) {
      return;
    }
    try {
      setIsVerifyingTotp(true);
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollmentData.id,
        challengeId,
        code: totpCode,
      });
      if (error) {
        throw error;
      }

      toast({
        title: t('settings.twoFactorEnabled'),
        description: t('settings.twoFactorEnabledDesc'),
      });
      setEnrollmentData(null);
      setChallengeId(null);
      setTotpCode('');
      await fetchTotpFactors();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.twoFactorVerifyFailedDesc');
      toast({
        title: t('settings.twoFactorVerifyFailed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingTotp(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!verifiedTotpFactor) {
      return;
    }
    try {
      setIsDisablingTotp(true);
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedTotpFactor.id });
      if (error) {
        throw error;
      }

      toast({
        title: t('settings.twoFactorDisabled'),
        description: t('settings.twoFactorDisabledDesc'),
      });
      await fetchTotpFactors();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.twoFactorDisableFailedDesc');
      toast({
        title: t('settings.twoFactorDisableFailed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsDisablingTotp(false);
    }
  };

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    try {
      setIsUpdatingPassword(true);

      const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !sessionData?.user?.email) {
        throw new Error(t('settings.passwordUpdateFailedDesc'));
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: sessionData.user.email,
        password: values.current_password,
      });

      if (reauthError) {
        passwordForm.setError('current_password', {
          type: 'manual',
          message: t('settings.currentPasswordIncorrect'),
        });
        throw new Error(t('settings.currentPasswordIncorrect'));
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: values.new_password });
      if (updateError) {
        throw updateError;
      }

      toast({
        title: t('settings.passwordUpdated'),
        description: t('settings.passwordUpdatedDesc'),
      });
      passwordForm.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.passwordUpdateFailedDesc');
      toast({
        title: t('settings.passwordUpdateFailed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
      </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.security')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('settings.passwordDesc')}
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-10 w-full" />
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-3/4" />
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-10 w-full" />
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-40" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.baseCurrency')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('settings.baseCurrencyDesc')}
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="base_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.baseCurrency')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your base currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('settings.baseCurrencyDesc')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.timezone')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timezones.map((timezone) => (
                          <SelectItem key={timezone.value} value={timezone.value}>
                            {timezone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('settings.timezoneDesc')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">{t('settings.theme')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.themeDesc')}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('settings.theme')}</label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t('theme.light')}</SelectItem>
                      <SelectItem value="dark">{t('theme.dark')}</SelectItem>
                      <SelectItem value="system">{t('theme.system')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('settings.language')}</label>
                  <Select value={language} onValueChange={(value) => setLanguage(value as 'en' | 'fr')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t('language.english')}</SelectItem>
                      <SelectItem value="fr">{t('language.french')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.languageDesc')}
                  </p>
                </div>
              </div>

              <Separator />
              <FormField
                control={form.control}
                name="default_lot_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.lotMethod')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lot accounting method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {lotMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            <div>
                              <div className="font-medium">{method.label}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {method.description}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('settings.lotMethodDesc')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={updateProfile.isPending}
                  className="min-w-24"
                >
                  {updateProfile.isPending ? t('settings.saving') : t('settings.saveChanges')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.security')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('settings.passwordDesc')}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('settings.passwordSectionTitle')}</h3>
              <Form {...passwordForm}>
                <form onSubmit={onPasswordSubmit} className="space-y-6">
                  <FormField
                    control={passwordForm.control}
                    name="current_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('settings.currentPassword')}</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="current-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="new_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('settings.newPassword')}</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormDescription>{t('settings.passwordRequirements')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirm_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('settings.confirmPassword')}</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isUpdatingPassword} className="min-w-36">
                      {isUpdatingPassword ? t('settings.updatingPassword') : t('settings.updatePassword')}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('settings.emailSectionTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('settings.emailDesc')}</p>
              <Form {...emailForm}>
                <form onSubmit={handleEmailSubmit} className="space-y-6">
                  <FormField
                    control={emailForm.control}
                    name="new_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('settings.newEmail')}</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailForm.control}
                    name="confirm_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('settings.confirmEmail')}</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailForm.control}
                    name="current_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('settings.currentPassword')}</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="current-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isUpdatingEmail} className="min-w-36">
                      {isUpdatingEmail ? t('settings.updatingEmail') : t('settings.updateEmail')}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t('settings.twoFactorTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('settings.twoFactorDesc')}</p>

              <div className="space-y-4">
                {!isMfaSupported ? (
                  <Alert>
                    <AlertTitle>{t('settings.twoFactorUnavailableTitle')}</AlertTitle>
                    <AlertDescription>{t('settings.twoFactorUnavailableDesc')}</AlertDescription>
                  </Alert>
                ) : isLoadingMfa ? (
                  <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                ) : verifiedTotpFactor ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t('settings.twoFactorEnabledHelper')}</p>
                    <Button
                      variant="outline"
                      onClick={handleDisableTotp}
                      disabled={isDisablingTotp}
                      className="min-w-36"
                    >
                      {isDisablingTotp ? t('settings.twoFactorDisabling') : t('settings.disableTwoFactor')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!enrollmentData ? (
                      <Button
                        onClick={handleStartTotpEnrollment}
                        disabled={isEnrollingTotp}
                        className="min-w-36"
                      >
                        {isEnrollingTotp ? t('settings.twoFactorEnabling') : t('settings.enableTwoFactor')}
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center">
                          <div className="w-full md:w-48 flex justify-center">
                            <img
                              src={enrollmentData.qr_code}
                              alt={t('settings.twoFactorQrAlt')}
                              loading="lazy"
                              className="rounded border"
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <p className="text-sm text-muted-foreground">{t('settings.twoFactorScan')}</p>
                            <div className="bg-muted rounded-md p-3 text-sm break-words">
                              <span className="font-medium">{t('settings.twoFactorSecret')}</span>: {enrollmentData.secret}
                            </div>
                          </div>
                        </div>

                        <form onSubmit={handleVerifyTotp} className="space-y-4">
                          <div>
                            <FormLabel>{t('settings.twoFactorEnterCode')}</FormLabel>
                            <Input
                              value={totpCode}
                              onChange={(event) => {
                                const value = event.target.value.replace(/[^\d]/g, '');
                                setTotpCode(value);
                              }}
                              placeholder={t('settings.twoFactorCodePlaceholder')}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={6}
                            />
                          </div>
                          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={handleCancelTotpEnrollment}
                              disabled={isVerifyingTotp || isCancelingTotp}
                            >
                              {isCancelingTotp ? t('settings.twoFactorCanceling') : t('settings.twoFactorCancel')}
                            </Button>
                            <Button
                              type="submit"
                              disabled={isVerifyingTotp || isCancelingTotp || totpCode.length < 6}
                              className="min-w-36"
                            >
                              {isVerifyingTotp ? t('settings.twoFactorVerifying') : t('settings.confirmTwoFactor')}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}