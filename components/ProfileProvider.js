import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const ProfileContext = createContext({
  profile: null,
  loading: true,
  refresh: () => Promise.resolve(),
})

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)

  const fetchProfile = async (userId) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      let uid = userId

      // If no userId provided, get it from session
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession()
        uid = session?.user?.id
      }

      if (!uid) {
        setProfile(null)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single()

      if (error) {
        // Profile doesn't exist yet (race condition after signup)
        if (error.code === 'PGRST116') {
          setProfile(null)
        } else {
          console.error('[ProfileProvider] fetch error:', error.message)
          setProfile(null)
        }
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('[ProfileProvider] unexpected error:', err)
      setProfile(null)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    // Listen for auth changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) fetchProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
          setLoading(false)
        }
        // Ignore USER_UPDATED and other events to avoid re-fetch loops
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <ProfileContext.Provider
      value={{ profile, loading, refresh: () => fetchProfile() }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
