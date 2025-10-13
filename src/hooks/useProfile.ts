import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MarketDataService } from '@/lib/marketData';

export interface UserProfile {
  id: string;
  owner_id: string;
  base_currency: string;
  timezone: string;
  default_lot_method: 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';
  market_data_provider: 'alphavantage' | 'yfinance';
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (error) throw error;
      return data as UserProfile;
    }
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<UserProfile, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('owner_id', user.id)
        .select()
        .single();

      if (!error) {
        return data;
      }

      const missingProviderColumn =
        typeof error?.message === 'string' &&
        error.message.includes("market_data_provider") &&
        error.message.includes('schema cache');

      if (!missingProviderColumn || !('market_data_provider' in updates)) {
        throw error;
      }

      const { market_data_provider, ...fallbackUpdates } = updates;

      if (typeof window !== 'undefined' && market_data_provider) {
        window.localStorage.setItem(MarketDataService.PROVIDER_STORAGE_KEY, market_data_provider);
      }

      if (Object.keys(fallbackUpdates).length === 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('owner_id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        return {
          ...profileData,
          market_data_provider: market_data_provider ?? profileData.market_data_provider,
        } as UserProfile;
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('profiles')
        .update(fallbackUpdates)
        .eq('owner_id', user.id)
        .select()
        .single();

      if (fallbackError) {
        throw fallbackError;
      }

      return {
        ...fallbackData,
        market_data_provider: market_data_provider ?? fallbackData?.market_data_provider,
      } as UserProfile;
    },
    onSuccess: (data) => {
      if (typeof window !== 'undefined' && data?.market_data_provider) {
        window.localStorage.setItem(
          MarketDataService.PROVIDER_STORAGE_KEY,
          data.market_data_provider,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] });
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating settings",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}