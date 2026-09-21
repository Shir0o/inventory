import {
  createAuditLog,
  deleteAuditLog,
  addInventoryItem,
  updateInventoryItem
} from './firestoreService';
import { findMatchingInventoryItem } from './inventoryCleanupService';

export interface ReconciliationStatus {
  reconciled: boolean;
  message: string;
  details?: {
    bibleEnStock: number;
    bibleEsStock: number;
    basicEnStock: number;
    basicEsStock: number;
    auditLogFound: boolean;
  };
}

/**
 * Checks whether the delivery received on 9/18/26 (32 Bible EN, 32 Bible ES, 30 Basic Elements EN, 30 Basic Elements ES)
 * is recorded in the Firestore audit logs and that Spanish Basic Elements has its stock properly accounted for.
 */
export function isSept18DeliveryReconciled(rawInventory: any[], rawLogs: any[]): boolean {
  if (!rawLogs || rawLogs.length === 0) return false;

  // Check for the delivery audit log tagged with 2026-09-18
  const hasSept18Log = rawLogs.some(log => {
    const occurred = log.metadata?.occurredAt || log.metadata?.date;
    const isSept18 = typeof occurred === 'string' && occurred.startsWith('2026-09-18');
    const isDelivery = log.action === 'DELIVERY_RECEIVED' || log.action === 'STOCK_UPDATE';
    const hasUnits = log.metadata?.delta === 124 || 
                     (log.details && log.details.includes('124')) ||
                     (log.metadata?.itemsSummary && log.metadata.itemsSummary.includes('Basic Elements'));
    return isSept18 && (isDelivery || hasUnits);
  });

  // Also check if Spanish Basic Elements exists and has stock >= 30
  const basicEsItem = findMatchingInventoryItem(
    rawInventory,
    'BKL-001-002-ES',
    'Elementos básicos de la vida cristiana, tomo 1',
    'ES'
  );
  const basicEsStock = Number(basicEsItem?.stockLevel ?? basicEsItem?.stock ?? 0);

  return hasSept18Log && basicEsStock >= 30;
}

/**
 * Reconciles the historical delivery received on 9/18/26:
 * - 32 Holy Bible Recovery Version (English)
 * - 32 Santa Biblia Versión Recobro (Spanish)
 * - 30 Basic Elements of the Christian Life, Vol. 1 (English)
 * - 30 Elementos básicos de la vida cristiana, tomo 1 (Spanish)
 *
 * Ensures:
 * 1. Spanish Basic Elements exists in Firestore with at least 30 stock.
 * 2. Other items have their stock properly credited.
 * 3. A canonical DELIVERY_RECEIVED audit log is created with date 2026-09-18 (+124 units).
 * 4. Item-specific delivery receipt audit logs are added for each of the 4 items with occurredAt: 2026-09-18.
 * 5. Any obsolete partial logs from today without Spanish Basic Elements are removed.
 */
export async function reconcileSept18Delivery(
  rawInventory: any[],
  rawLogs: any[]
): Promise<ReconciliationStatus> {
  const DELIVERY_DATE = '2026-09-18';
  const totalReceived = 124;

  const itemsToReconcile = [
    {
      code: 'BIB-001-001-EN',
      baseCode: 'BIB-001',
      title: 'Holy Bible Recovery Version',
      lang: 'EN' as const,
      qty: 32,
      category: 'Bibles' as const
    },
    {
      code: 'BIB-001-002-ES',
      baseCode: 'BIB-001',
      title: 'Santa Biblia Versión Recobro',
      lang: 'ES' as const,
      qty: 32,
      category: 'Bibles' as const
    },
    {
      code: 'BKL-001-001-EN',
      baseCode: 'BKL-001-001',
      title: 'Basic Elements of the Christian Life, Vol. 1',
      lang: 'EN' as const,
      qty: 30,
      category: 'Booklets' as const
    },
    {
      code: 'BKL-001-002-ES',
      baseCode: 'BKL-001-001',
      title: 'Elementos básicos de la vida cristiana, tomo 1',
      lang: 'ES' as const,
      qty: 30,
      category: 'Booklets' as const
    }
  ];

  try {
    // 1. Clean up any faulty / partial delivery check-in logs from today (delta === 94)
    if (rawLogs && rawLogs.length > 0) {
      for (const log of rawLogs) {
        const occurred = log.metadata?.occurredAt;
        const isToday = typeof occurred === 'string' && (occurred.startsWith('2026-09-21') || occurred.startsWith('2026-09-20'));
        const isPartialDelivery = log.action === 'DELIVERY_RECEIVED' && log.metadata?.delta === 94;
        if (isToday && isPartialDelivery) {
          try {
            await deleteAuditLog(log.id);
          } catch (e) {
            console.warn('Non-fatal: could not delete partial audit log:', e);
          }
        }
      }
    }

    // 2. Ensure each item exists and has stock accounted for
    const resolvedItemIds: Record<string, string> = {};

    for (const itemDef of itemsToReconcile) {
      let matched = findMatchingInventoryItem(
        rawInventory,
        itemDef.code,
        itemDef.title,
        itemDef.lang
      );

      if (!matched) {
        // Create the missing document in Firestore
        const newDocRef = await addInventoryItem({
          sku: itemDef.code,
          title: itemDef.title,
          category: itemDef.category,
          language: itemDef.lang === 'ES' ? 'Spanish' : 'English',
          stockLevel: itemDef.qty,
          stock: itemDef.qty,
          status: 'Healthy',
          unitPrice: 0,
          baseCode: itemDef.baseCode,
          baseName: itemDef.title
        });
        if (newDocRef?.id) {
          resolvedItemIds[itemDef.code] = newDocRef.id;
        }
      } else {
        resolvedItemIds[itemDef.code] = matched.id;
        const currentStock = Number(matched.stockLevel ?? matched.stock ?? 0);
        // If current stock is 0 or less than the delivered quantity, update it
        if (currentStock === 0 || currentStock < itemDef.qty) {
          const newStock = Math.max(currentStock + itemDef.qty, itemDef.qty);
          await updateInventoryItem(matched.id, {
            stockLevel: newStock,
            stock: newStock,
            status: 'Healthy'
          });
        }
      }
    }

    // 3. Check if 2026-09-18 DELIVERY_RECEIVED log already exists
    const existingSept18Log = rawLogs.find(log => {
      const occ = log.metadata?.occurredAt || log.metadata?.date;
      return log.action === 'DELIVERY_RECEIVED' && typeof occ === 'string' && occ.startsWith(DELIVERY_DATE);
    });

    if (!existingSept18Log) {
      const itemsSummary = '32 Holy Bible (EN), 32 Santa Biblia (ES), 30 Basic Elements (EN), 30 Elementos básicos (ES)';
      await createAuditLog(
        'DELIVERY_RECEIVED',
        'delivery',
        'inventory',
        `Delivery check-in: ${totalReceived} units received into inventory (${itemsSummary})`,
        {
          delta: totalReceived,
          receiptsCount: 4,
          occurredAt: DELIVERY_DATE,
          orderTitle: 'Literature delivery (9/18/26)',
          itemsSummary,
          items: itemsToReconcile.map(i => ({
            itemId: resolvedItemIds[i.code] || i.code,
            code: i.code,
            title: i.title,
            lang: i.lang,
            qty: i.qty
          }))
        }
      );
    }

    // 4. Create individual item delivery logs with occurredAt: 2026-09-18 if not already logged
    for (const itemDef of itemsToReconcile) {
      const itemId = resolvedItemIds[itemDef.code];
      const hasItemLog = rawLogs.some(log => {
        const occ = log.metadata?.occurredAt || log.metadata?.date;
        const matchesDate = typeof occ === 'string' && occ.startsWith(DELIVERY_DATE);
        const matchesItem = log.targetId === itemId || log.metadata?.sku === itemDef.code;
        return matchesDate && matchesItem;
      });

      if (!hasItemLog && itemId) {
        await createAuditLog(
          'STOCK_UPDATE',
          itemId,
          'inventory',
          `Delivery check-in: +${itemDef.qty} units received (${itemDef.title})`,
          {
            delta: itemDef.qty,
            previousStock: 0,
            newStock: itemDef.qty,
            sku: itemDef.code,
            title: itemDef.title,
            lang: itemDef.lang,
            occurredAt: DELIVERY_DATE,
            note: `Delivery check-in received on ${DELIVERY_DATE}`
          }
        );
      }
    }

    return {
      reconciled: true,
      message: `Historical delivery for 9/18/26 successfully reconciled: 124 units (32 Bible EN, 32 Bible ES, 30 Basic Elements EN, 30 Basic Elements ES).`
    };
  } catch (err: any) {
    console.error('Failed to reconcile 9/18 delivery history:', err);
    return {
      reconciled: false,
      message: `Reconciliation error: ${err?.message || 'Unknown error'}`
    };
  }
}
