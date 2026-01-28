/**
 * Account Service
 * 
 * Handles account-related operations including data export.
 * All operations use secure API routes.
 */

// Note: Using fetch directly instead of apiPost to handle blob response

/**
 * Export all user data as JSON file
 * Triggers browser download automatically
 */
export async function exportUserData(): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const response = await fetch('/api/account/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let errorMessage = 'Failed to export data'
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }

      return {
        success: false,
        error: new Error(errorMessage),
      }
    }

    // Get the filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = 'viewbait-export.json'
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    }

    // Get response as blob
    const blob = await response.blob()

    // Create download link and trigger download
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Failed to export data'),
    }
  }
}
