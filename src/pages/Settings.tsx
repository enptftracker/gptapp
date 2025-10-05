import { useEffect } from "react";
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

const settingsSchema = z.object({
  base_currency: z.string().min(1, "Please select a base currency"),
  timezone: z.string().min(1, "Please select a timezone"),
  default_lot_method: z.enum(['FIFO', 'LIFO', 'HIFO', 'AVERAGE'])
});

type SettingsFormData = z.infer<typeof settingsSchema>;

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

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      base_currency: 'USD',
      timezone: 'UTC',
      default_lot_method: 'FIFO',
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
    }
  }, [profile, form]);

  const onSubmit = async (data: SettingsFormData) => {
    await updateProfile.mutateAsync(data);
  };

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

              <Separator />

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
    </div>
  );
}