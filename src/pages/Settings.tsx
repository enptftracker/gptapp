import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const settingsSchema = z.object({
  base_currency: z.string().min(1, "Please select a base currency"),
  timezone: z.string().min(1, "Please select a timezone"),
  default_lot_method: z.enum(['FIFO', 'LIFO', 'HIFO', 'AVERAGE'])
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const passwordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

type PasswordFormData = z.infer<typeof passwordSchema>;

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
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      base_currency: profile?.base_currency || 'USD',
      timezone: profile?.timezone || 'UTC',
      default_lot_method: profile?.default_lot_method || 'FIFO',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: ''
    }
  });

  const isDirty = form.formState.isDirty;

  // Update form when profile data loads
  useEffect(() => {
    if (profile && !isDirty) {
      form.reset({
        base_currency: profile.base_currency,
        timezone: profile.timezone,
        default_lot_method: profile.default_lot_method,
      });
    }
  }, [profile, form, isDirty]);

  const onSubmit = async (data: SettingsFormData) => {
    await updateProfile.mutateAsync(data);
  };

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    try {
      await supabase.auth.updateUser({ password: data.newPassword });
      toast({
        title: 'Password updated',
        description: 'Your password has been updated successfully.'
      });
      passwordForm.reset();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      toast({
        title: 'Unable to update password',
        description: message,
        variant: 'destructive'
      });
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);

    try {
      const [portfoliosResponse, transactionsResponse, symbolsResponse] = await Promise.all([
        supabase.from('portfolios').select('*').order('created_at', { ascending: true }),
        supabase.from('transactions').select('*').order('trade_date', { ascending: true }),
        supabase.from('symbols').select('*').order('ticker', { ascending: true })
      ]);

      if (portfoliosResponse.error) throw portfoliosResponse.error;
      if (transactionsResponse.error) throw transactionsResponse.error;
      if (symbolsResponse.error) throw symbolsResponse.error;

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        profile,
        portfolios: portfoliosResponse.data,
        transactions: transactionsResponse.data,
        symbols: symbolsResponse.data,
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `portfolio-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export ready',
        description: 'A JSON file with your portfolio data has been downloaded.'
      });
    } catch (error: unknown) {
      console.error('Export error:', error);
      const message = error instanceof Error ? error.message : 'Unable to export data right now.';
      toast({
        title: 'Export failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSignOutAll = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut({ scope: 'global' });
      toast({
        title: 'Signed out everywhere',
        description: 'All active sessions have been revoked.'
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not end sessions.';
      toast({
        title: 'Unable to end sessions',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
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
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account Preferences</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure your portfolio calculation and display preferences.
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
                    <FormLabel>Base Currency</FormLabel>
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
                      Your portfolio values and calculations will be displayed in this currency.
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
                    <FormLabel>Timezone</FormLabel>
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
                      Used for displaying timestamps and market hours.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="default_lot_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Lot Accounting Method</FormLabel>
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
                      This method determines how cost basis is calculated when selling positions.
                      Changes will apply to future calculations only.
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
                  {updateProfile.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <p className="text-sm text-muted-foreground">
              Keep your account protected with strong credentials and session controls.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter a new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Re-enter the new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => passwordForm.reset()}
                    disabled={passwordForm.formState.isSubmitting}
                  >
                    Clear
                  </Button>
                  <Button
                    type="submit"
                    disabled={passwordForm.formState.isSubmitting}
                    className="sm:w-auto"
                  >
                    {passwordForm.formState.isSubmitting ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </Form>

            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Row level security</p>
              <p>
                All portfolio, transaction, and watchlist tables enforce Supabase row level security so only your
                authenticated account can view or modify records.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Revoke every active session if you notice unusual account activity.
              </div>
              <Button
                variant="outline"
                onClick={handleSignOutAll}
                disabled={isSigningOut}
                className="sm:w-auto"
              >
                {isSigningOut ? 'Signing out...' : 'Sign out on all devices'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <p className="text-sm text-muted-foreground">
              Export a backup of your investment records and understand how market data is secured.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Download a JSON export containing portfolios, transactions, and saved symbols for your own archive.
              </p>
              <Button
                onClick={handleExportData}
                disabled={isExporting}
                className="w-full sm:w-auto"
              >
                {isExporting ? 'Preparing export...' : 'Export data'}
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Market data integrity</p>
              <p>
                Live pricing updates run exclusively through secured Supabase Edge Functions that use the service role
                key. Client applications only have read access to the price cache so write operations stay protected.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}