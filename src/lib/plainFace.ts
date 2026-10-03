/*
 * A plain smiling face, drawn rather than fetched.
 *
 * The rig used for fitting an accessory had no face, and a blank head is an
 * unsettling thing to put a hat on - Staw asked for a smile and he is right:
 * the point of the fitting view is to judge how something looks on a person,
 * and a head with nothing on it does not read as a person.
 *
 * Drawn here instead of loading FACE-1119 because this is a mannequin, not
 * somebody: it must work before anybody signs in, in the Workspace, and on a
 * page that cannot reach storage. A face that fails to load would leave the
 * blank head this exists to avoid.
 *
 * Memoised - it is the same picture every time, and a data URL per render is
 * a new texture per render.
 */
let drawn: string | null = null

export function plainFace(): string {
  if (drawn) return drawn

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const brush = canvas.getContext('2d')
  if (!brush) return ''

  brush.clearRect(0, 0, 256, 256)
  brush.fillStyle = '#1a1a22'
  brush.beginPath(); brush.ellipse(90, 100, 15, 21, 0, 0, Math.PI * 2); brush.fill()
  brush.beginPath(); brush.ellipse(166, 100, 15, 21, 0, 0, Math.PI * 2); brush.fill()
  brush.lineWidth = 11
  brush.strokeStyle = '#1a1a22'
  brush.lineCap = 'round'
  brush.beginPath(); brush.arc(128, 138, 44, 0.3, Math.PI - 0.3); brush.stroke()

  drawn = canvas.toDataURL('image/png')
  return drawn
}
