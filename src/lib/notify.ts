import { supabase } from './supabase'

interface NotifyParams {
  booking_id: string
  property_id: string
  guest_name: string
  check_in: string
  check_out: string
  room_type_name: string
  room_name: string
  total_amount: number
  source: string
}

/**
 * Sends a booking notification email to all staff assigned to the property.
 * Fires and forgets — errors are logged but don't block the booking flow.
 */
export async function notifyBooking(params: NotifyParams): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('notify-booking', {
      body: params,
    })
    if (error) console.error('Notification error:', error)
  } catch (err) {
    console.error('Failed to send notification:', err)
  }
}