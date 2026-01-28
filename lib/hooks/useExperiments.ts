/**
 * useExperiments Hook
 * 
 * React hook for managing experiments state and API calls.
 */

import { useState, useCallback, useEffect } from 'react'
import * as experimentsService from '@/lib/services/experiments'
import type {
  Experiment,
  CreateExperimentRequest,
  GenerateVariantsRequest,
} from '@/lib/services/experiments'

export interface UseExperimentsReturn {
  experiments: Experiment[]
  experiment: Experiment | null
  isLoading: boolean
  error: string | null
  fetchExperiments: (params?: {
    limit?: number
    offset?: number
    status?: string
    video_id?: string
  }) => Promise<void>
  fetchExperiment: (id: string) => Promise<void>
  createExperiment: (data: CreateExperimentRequest) => Promise<Experiment>
  updateExperiment: (
    id: string,
    data: Partial<{
      status: Experiment['status']
      notes: string
      started_at: string | null
      completed_at: string | null
    }>
  ) => Promise<Experiment>
  deleteExperiment: (id: string) => Promise<void>
  generateVariants: (experimentId: string, data: GenerateVariantsRequest) => Promise<void>
  generateSingleVariant: (experimentId: string, label: 'A' | 'B' | 'C', data: GenerateVariantsRequest) => Promise<void>
  markStarted: (experimentId: string) => Promise<void>
  importResult: (
    experimentId: string,
    data: {
      winner_variant_label: 'A' | 'B' | 'C'
      youtube_label?: string
      watch_time_share_a?: number
      watch_time_share_b?: number
      watch_time_share_c?: number
    }
  ) => Promise<void>
  clearError: () => void
  clearExperiment: () => void
}

export function useExperiments(): UseExperimentsReturn {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchExperiments = useCallback(async (params?: {
    limit?: number
    offset?: number
    status?: string
    video_id?: string
  }) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await experimentsService.listExperiments(params)
      setExperiments(result.experiments)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch experiments'
      setError(errorMessage)
      console.error('Failed to fetch experiments:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchExperiment = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await experimentsService.getExperiment(id)
      setExperiment(result.experiment)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch experiment'
      setError(errorMessage)
      console.error('Failed to fetch experiment:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createExperiment = useCallback(async (data: CreateExperimentRequest): Promise<Experiment> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await experimentsService.createExperiment(data)
      setExperiment(result.experiment)
      // Refresh experiments list
      await fetchExperiments()
      return result.experiment
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create experiment'
      setError(errorMessage)
      console.error('Failed to create experiment:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [fetchExperiments])

  const updateExperiment = useCallback(async (
    id: string,
    data: Partial<{
      status: Experiment['status']
      notes: string
      started_at: string | null
      completed_at: string | null
    }>
  ): Promise<Experiment> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await experimentsService.updateExperiment(id, data)
      setExperiment(result.experiment)
      // Update in experiments list
      setExperiments((prev) =>
        prev.map((exp) => (exp.id === id ? result.experiment : exp))
      )
      return result.experiment
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update experiment'
      setError(errorMessage)
      console.error('Failed to update experiment:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const deleteExperiment = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await experimentsService.deleteExperiment(id)
      // Remove from experiments list
      setExperiments((prev) => prev.filter((exp) => exp.id !== id))
      // Clear current experiment if it was deleted
      if (experiment?.id === id) {
        setExperiment(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete experiment'
      setError(errorMessage)
      console.error('Failed to delete experiment:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [experiment])

  const generateVariants = useCallback(async (
    experimentId: string,
    data: GenerateVariantsRequest
  ) => {
    setIsLoading(true)
    setError(null)
    try {
      await experimentsService.generateVariants(experimentId, data)
      // Refresh experiment to get updated variants
      await fetchExperiment(experimentId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate variants'
      setError(errorMessage)
      console.error('Failed to generate variants:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [fetchExperiment])

  const generateSingleVariant = useCallback(async (
    experimentId: string,
    label: 'A' | 'B' | 'C',
    data: GenerateVariantsRequest
  ) => {
    setError(null)
    try {
      await experimentsService.generateSingleVariant(experimentId, label, data)
      // Refresh experiment to get updated variants
      await fetchExperiment(experimentId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate variant'
      setError(errorMessage)
      console.error(`Failed to generate variant ${label}:`, err)
      throw err
    }
  }, [fetchExperiment])

  const markStarted = useCallback(async (experimentId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await experimentsService.markExperimentStarted(experimentId)
      setExperiment(result.experiment)
      // Update in experiments list
      setExperiments((prev) =>
        prev.map((exp) => (exp.id === experimentId ? result.experiment : exp))
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark experiment as started'
      setError(errorMessage)
      console.error('Failed to mark experiment as started:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const importResult = useCallback(async (
    experimentId: string,
    data: {
      winner_variant_label: 'A' | 'B' | 'C'
      youtube_label?: string
      watch_time_share_a?: number
      watch_time_share_b?: number
      watch_time_share_c?: number
    }
  ) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await experimentsService.importResult(experimentId, data)
      setExperiment(result.experiment)
      // Update in experiments list
      setExperiments((prev) =>
        prev.map((exp) => (exp.id === experimentId ? result.experiment : exp))
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import result'
      setError(errorMessage)
      console.error('Failed to import result:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const clearExperiment = useCallback(() => {
    setExperiment(null)
  }, [])

  return {
    experiments,
    experiment,
    isLoading,
    error,
    fetchExperiments,
    fetchExperiment,
    createExperiment,
    updateExperiment,
    deleteExperiment,
    generateVariants,
    generateSingleVariant,
    markStarted,
    importResult,
    clearError,
    clearExperiment,
  }
}
