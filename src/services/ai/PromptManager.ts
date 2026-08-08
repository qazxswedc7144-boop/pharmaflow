/**
 * PharmaFlow Prompt Manager
 * Central repository for system instructions, template variables, and safety guardrails.
 */

import { PromptTemplate, AIUserContext } from './types';

export class PromptManager {
  private static templates: Map<string, PromptTemplate> = new Map([
    [
      'inventory_audit_assistant',
      {
        id: 'inventory_audit_assistant',
        name: 'Inventory Audit & Reorder AI',
        description: 'Analyzes stock levels, expiration risks, and recommends optimal purchasing quantities.',
        systemInstruction: `أنت مساعد الذكاء الاصطناعي لإدارة مخزون الصيدليات بـ PharmaFlow ERP.
مهامك:
1. تحليل أصناف المخزون الراكد، القريب من انتهاء الصلاحية، والمنخفض.
2. اقتراح الكميات المثالية لإعادة الطلب دون تجاوز السقف المالي.
3. التنبيه الفوري لأي صنف به انحراف أو هدر.
شروط صارمة:
- لا تقم أبداً بتشجيع تجاوز مدة الصلاحية.
- اكتب الإجابة باللغة العربية المهنية.
- استند فقط إلى البيانات المزودة في السياق المرفق.`,
        userTemplate: `سياق المخزون المتاح:
{{inventoryContext}}

السؤال / الطلب:
{{userQuery}}`,
        requiredScopes: [{ module: 'inventory', action: 'analyze', requiredRole: 'pharmacist' }],
        responseFormat: 'text',
      },
    ],
    [
      'drug_interaction_checker',
      {
        id: 'drug_interaction_checker',
        name: 'Drug Interaction Guard',
        description: 'Checks potential drug-drug or drug-disease contraindications based on active ingredients.',
        systemInstruction: `أنت صيدلي استشاري رقمي متخصص في التحقق من التداخلات الدوائية والجرعات.
الهدف:
فحص المادة الفعالة والتداخلات الدوائية والتحذير من أي مخاطر سمية أو تعارض دوائي.
شروط صارمة:
- لا تعطي بدائل دوائية دون توضيح المادة الفعالة والتركيز.
- يجب دائماً تضمين تنبيه مراجعة الصيدلي المسؤول.`,
        userTemplate: `بيانات الدواء / المواد الفعالة:
{{drugContext}}

استفسار التداخل:
{{userQuery}}`,
        requiredScopes: [{ module: 'drugs', action: 'recommend', requiredRole: 'pharmacist' }],
        responseFormat: 'text',
      },
    ],
    [
      'financial_summary_explainer',
      {
        id: 'financial_summary_explainer',
        name: 'Financial Performance Analyst',
        description: 'Summarizes financial trends, COGS, gross margins, and customer/supplier balances.',
        systemInstruction: `أنت المحلل المالي الاستراتيجي لـ PharmaFlow ERP.
الهدف:
تحليل الميزانية العمومية، هامش الربح الإجمالي، ومصروفات التشغيل للصيدلية تقديم رؤى مالية دقيقة.
شروط صارمة:
- لا تقم بتوليد أرقام وهمية؛ استخدم البيانات الحقيقية فقط.
- وضح دائماً نسبة الربح ومؤشرات السيولة بدقة.`,
        userTemplate: `الملخص المالي المعتمد:
{{financialContext}}

طلب التحليل المالي:
{{userQuery}}`,
        requiredScopes: [{ module: 'accounting', action: 'analyze', requiredRole: 'accountant' }],
        responseFormat: 'text',
      },
    ],
  ]);

  /**
   * Retrieves prompt template by ID.
   */
  public static getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Compiles template string with variable values.
   */
  public static compilePrompt(
    templateStr: string,
    variables: Record<string, unknown>
  ): string {
    let result = templateStr;
    for (const [key, val] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const stringifiedVal = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
      result = result.replaceAll(placeholder, stringifiedVal);
    }
    return result;
  }

  /**
   * Checks if user has necessary role to execute prompt template.
   */
  public static authorizeUserForTemplate(
    template: PromptTemplate,
    userContext: AIUserContext
  ): { authorized: boolean; reason?: string } {
    const userRole = userContext.userRole as string;
    if (userRole === 'admin') {
      return { authorized: true };
    }

    for (const scope of template.requiredScopes) {
      if (scope.requiredRole === 'admin' && userRole !== 'admin') {
        return { authorized: false, reason: 'صلاحيات المدير الإداري مطلوبة لهذا الاستعلام.' };
      }
      if (scope.requiredRole === 'accountant' && !['admin', 'accountant', 'manager'].includes(userRole)) {
        return { authorized: false, reason: 'صلاحيات المحاسب المالي مطلوبة لهذا الاستعلام.' };
      }
      if (scope.requiredRole === 'pharmacist' && !['admin', 'pharmacist', 'manager'].includes(userRole)) {
        return { authorized: false, reason: 'صلاحيات الصيدلي المسؤول مطلوبة لهذا الاستعلام.' };
      }
    }

    return { authorized: true };
  }
}
