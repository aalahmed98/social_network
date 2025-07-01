import { logger } from "./logger";

interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  operation: string;
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private thresholds = {
    api: 2000, // 2 seconds
    render: 100, // 100ms
    interaction: 50, // 50ms
  };

  /**
   * Start tracking performance for an operation
   */
  start(
    operationId: string,
    operation: string,
    metadata?: Record<string, unknown>
  ): void {
    const startTime = performance.now();

    this.metrics.set(operationId, {
      startTime,
      operation,
      metadata,
    });

    logger.debug("Performance tracking started", {
      component: "PerformanceMonitor",
      action: "start_tracking",
      metadata: {
        operationId,
        operation,
        startTime,
        ...metadata,
      },
    });
  }

  /**
   * End tracking and log performance metrics
   */
  end(operationId: string): PerformanceMetrics | null {
    const metric = this.metrics.get(operationId);
    if (!metric) {
      logger.warn("Performance tracking not found", {
        component: "PerformanceMonitor",
        action: "end_tracking",
        metadata: { operationId },
      });
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    const completedMetric: PerformanceMetrics = {
      ...metric,
      endTime,
      duration,
    };

    // Log performance
    const isSlowOperation = this.isSlowOperation(metric.operation, duration);

    if (isSlowOperation) {
      logger.warn("Slow operation detected", {
        component: "PerformanceMonitor",
        action: "slow_operation",
        metadata: {
          operationId,
          operation: metric.operation,
          duration: Math.round(duration),
          threshold: this.getThreshold(metric.operation),
          ...metric.metadata,
        },
      });
    } else {
      logger.info("Operation completed", {
        component: "PerformanceMonitor",
        action: "operation_completed",
        metadata: {
          operationId,
          operation: metric.operation,
          duration: Math.round(duration),
          ...metric.metadata,
        },
      });
    }

    // Clean up
    this.metrics.delete(operationId);

    return completedMetric;
  }

  /**
   * Track API call performance
   */
  async trackApiCall<T>(
    url: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const operationId = `api-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`;

    this.start(operationId, "api", { url, ...metadata });

    try {
      const result = await operation();
      this.end(operationId);
      return result;
    } catch (error) {
      logger.error("API call failed", {
        component: "PerformanceMonitor",
        action: "api_call_failed",
        metadata: {
          operationId,
          url,
          error: error instanceof Error ? error.message : "Unknown error",
          ...metadata,
        },
      });
      this.end(operationId);
      throw error;
    }
  }

  /**
   * Track React component render performance
   */
  trackRender(componentName: string, renderFunction: () => void): void {
    const operationId = `render-${componentName}-${Date.now()}`;

    this.start(operationId, "render", { componentName });
    renderFunction();
    this.end(operationId);
  }

  /**
   * Track user interaction performance
   */
  async trackInteraction<T>(
    interactionType: string,
    operation: () => Promise<T> | T,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const operationId = `interaction-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`;

    this.start(operationId, "interaction", { interactionType, ...metadata });

    try {
      const result = await operation();
      this.end(operationId);
      return result;
    } catch (error) {
      logger.error("User interaction failed", {
        component: "PerformanceMonitor",
        action: "interaction_failed",
        metadata: {
          operationId,
          interactionType,
          error: error instanceof Error ? error.message : "Unknown error",
          ...metadata,
        },
      });
      this.end(operationId);
      throw error;
    }
  }

  /**
   * Get Web Vitals metrics
   */
  getWebVitals(): Record<string, number> {
    const navigation = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;

    return {
      // Core Web Vitals approximations
      firstContentfulPaint: this.getFirstContentfulPaint(),
      largestContentfulPaint: this.getLargestContentfulPaint(),
      cumulativeLayoutShift: 0, // Would need additional tracking
      firstInputDelay: 0, // Would need additional tracking

      // Navigation metrics
      domContentLoaded: navigation
        ? navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart
        : 0,
      loadComplete: navigation
        ? navigation.loadEventEnd - navigation.loadEventStart
        : 0,
      totalLoadTime: navigation
        ? navigation.loadEventEnd - navigation.fetchStart
        : 0,
    };
  }

  private isSlowOperation(operation: string, duration: number): boolean {
    const threshold = this.getThreshold(operation);
    return duration > threshold;
  }

  private getThreshold(operation: string): number {
    if (operation === "api") return this.thresholds.api;
    if (operation === "render") return this.thresholds.render;
    if (operation === "interaction") return this.thresholds.interaction;
    return 1000; // Default 1 second
  }

  private getFirstContentfulPaint(): number {
    const paintEntries = performance.getEntriesByType("paint");
    const fcpEntry = paintEntries.find(
      (entry) => entry.name === "first-contentful-paint"
    );
    return fcpEntry ? fcpEntry.startTime : 0;
  }

  private getLargestContentfulPaint(): number {
    // This would typically use the Largest Contentful Paint API
    // For now, return 0 as a placeholder
    return 0;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export React hook for component performance tracking
export const usePerformanceTracking = (componentName: string) => {
  return {
    trackRender: (renderFunction: () => void) =>
      performanceMonitor.trackRender(componentName, renderFunction),

    trackInteraction: <T>(
      interactionType: string,
      operation: () => Promise<T> | T
    ) =>
      performanceMonitor.trackInteraction(interactionType, operation, {
        componentName,
      }),
  };
};
