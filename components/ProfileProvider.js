import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const ProfileContext = createContext({
  profile: null,
  loading: true,
  profileMissing: false,
  refresh: () => Promise.resolve(),
})

export function ProfileProvider({ children }) {
  const [profile, setProfile]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [profileMissing, setProfileMissing] = useState(false)
  const fetchingRef = useRef(false)

  const fetchProfile = useCallback(async (userId) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      let uid = userId
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession()
        uid = session?.user?.id
      }

      if (!uid) {
        setProfile(null)
        setProfileMissing(false)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          const ensured = await ensureProfile(uid)
          if (ensured) {
            setProfile(ensured)
            setProfileMissing(false)
          } else {
            setProfile(null)
            setProfileMissing(true)
          }
        } else {
          console.error('[ProfileProvider] fetch error:', error.message)
          setProfile(null)
          setProfileMissing(false)
        }
      } else {
        setProfile(data)
        setProfileMissing(false)
      }
    } catch (err) {
      console.error('[ProfileProvider] unexpected error:', err)
      setProfile(null)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  async function ensureProfile(uid) {
    try {
      const res = await fetch('/api/users/ensure-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      })
      if (!res.ok) return null
      const json = await res.json()
      return json.profile || null
    } catch {
      return null
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setProfileMissing(false)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) fetchProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
          setProfileMissing(false)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  return (
    <ProfileContext.Provider
      value={{ profile, loading, profileMissing, refresh: () => fetchProfile() }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
