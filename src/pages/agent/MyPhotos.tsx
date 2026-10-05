import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/shared/EmptyState'
import { Image } from 'lucide-react'
import type { Photo } from '@/types'

export default function MyPhotos() {
  const { profile } = useAuth()

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['agent-photos', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('agent_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error

      const withUrls = await Promise.all(
        (data as Photo[]).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from('outlet-photos')
            .createSignedUrl(p.storage_path, 3600)
          return { ...p, signed_url: signed?.signedUrl }
        })
      )
      return withUrls
    },
    enabled: !!profile,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    )
  }

  if (!photos.length) {
    return (
      <EmptyState
        icon={Image}
        title="No photos yet"
        description="Photos from your visits will appear here."
      />
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">My Photos</h1>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="aspect-square overflow-hidden rounded-lg bg-slate-100">
            {p.signed_url ? (
              <img
                src={p.signed_url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <Image className="h-6 w-6" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
