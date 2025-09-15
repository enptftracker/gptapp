import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService, Profile } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface UserProfile {
  id: string;
  owner_id: string;
  base_currency: string;
  timezone: string;
  default_lot_method: 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  return useQuery<Profile | null>({
    queryKey: ['profile'],
    queryFn: () => profileService.get()
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<UserProfile, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>) => {
      return profileService.update(updates);
    },
    onSuccess: () => {
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