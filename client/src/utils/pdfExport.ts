import jsPDF from 'jspdf';
import { AnalyticsData } from '../types/analytics';
import { FormData } from '../services/formsService';

// Color palette matching the app's Tailwind colors
const colors = {
  primary: [59, 130, 246] as [number, number, number],      // blue-500
  primaryDark: [37, 99, 235] as [number, number, number],   // blue-600
  green: [34, 197, 94] as [number, number, number],         // green-500
  greenLight: [220, 252, 231] as [number, number, number],  // green-100
  red: [239, 68, 68] as [number, number, number],           // red-500
  redLight: [254, 226, 226] as [number, number, number],    // red-100
  amber: [245, 158, 11] as [number, number, number],        // amber-500
  amberLight: [254, 243, 199] as [number, number, number],  // amber-100
  purple: [139, 92, 246] as [number, number, number],       // purple-500
  purpleLight: [237, 233, 254] as [number, number, number], // purple-100
  gray50: [249, 250, 251] as [number, number, number],
  gray100: [243, 244, 246] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray300: [209, 213, 219] as [number, number, number],
  gray400: [156, 163, 175] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray600: [75, 85, 99] as [number, number, number],
  gray700: [55, 65, 81] as [number, number, number],
  gray800: [31, 41, 55] as [number, number, number],
  gray900: [17, 24, 39] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

/**
 * Generate a comprehensive PDF analytics report with modern UI design
 */
export function generateAnalyticsPDF(
  form: FormData,
  analytics: AnalyticsData,
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = margin;

  // Helper functions
  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - 20) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  const drawCard = (x: number, y: number, width: number, height: number, title?: string, iconColor?: [number, number, number]) => {
    // Card background with shadow effect
    doc.setFillColor(...colors.gray100);
    doc.roundedRect(x + 1, y + 1, width, height, 3, 3, 'F');
    
    doc.setFillColor(...colors.white);
    doc.setDrawColor(...colors.gray200);
    doc.roundedRect(x, y, width, height, 3, 3, 'FD');
    
    if (title) {
      // Icon circle
      if (iconColor) {
        doc.setFillColor(...iconColor);
        doc.circle(x + 12, y + 12, 4, 'F');
      }
      
      // Title
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.gray900);
      doc.text(title, iconColor ? x + 20 : x + 8, y + 14);
    }
    
    return y + (title ? 22 : 8);
  };

  const drawProgressBar = (x: number, y: number, width: number, percentage: number, color: [number, number, number]) => {
    // Background
    doc.setFillColor(...colors.gray200);
    doc.roundedRect(x, y, width, 4, 2, 2, 'F');
    
    // Fill
    const fillWidth = (width * percentage) / 100;
    if (fillWidth > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(x, y, Math.max(fillWidth, 4), 4, 2, 2, 'F');
    }
  };

  const drawBadge = (x: number, y: number, text: string, bgColor: [number, number, number], textColor: [number, number, number]) => {
    doc.setFontSize(7);
    const textWidth = doc.getTextWidth(text);
    const badgeWidth = textWidth + 6;
    const badgeHeight = 10;
    
    doc.setFillColor(...bgColor);
    doc.roundedRect(x, y - 7, badgeWidth, badgeHeight, 2, 2, 'F');
    
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text(text, x + 3, y);
    
    return badgeWidth + 4;
  };

  // ===== HEADER =====
  // Blue gradient header bar
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Darker accent line
  doc.setFillColor(...colors.primaryDark);
  doc.rect(0, 43, pageWidth, 2, 'F');
  
  // FormulAI branding
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.white);
  doc.text('FormulAI', margin, 22);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Analytics Report', margin, 32);
  
  // Form title on the right
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const formTitle = form.title.length > 30 ? form.title.substring(0, 27) + '...' : form.title;
  const titleWidth = doc.getTextWidth(formTitle);
  doc.text(formTitle, pageWidth - margin - titleWidth, 22);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const dateStr = `Generated: ${new Date().toLocaleDateString()} • ${analytics.totalResponsesAnalyzed} responses`;
  const dateWidth = doc.getTextWidth(dateStr);
  doc.text(dateStr, pageWidth - margin - dateWidth, 32);

  yPos = 55;

  // ===== STATS OVERVIEW ROW =====
  const statCardWidth = (contentWidth - 15) / 4;
  const stats = [
    { label: 'Total Responses', value: analytics.totalResponsesAnalyzed.toString(), color: colors.primary },
    { label: 'Positive', value: `${analytics.sentiment?.overall?.positive || 0}%`, color: colors.green },
    { label: 'Neutral', value: `${analytics.sentiment?.overall?.neutral || 0}%`, color: colors.gray500 },
    { label: 'Negative', value: `${analytics.sentiment?.overall?.negative || 0}%`, color: colors.red },
  ];

  stats.forEach((stat, i) => {
    const x = margin + i * (statCardWidth + 5);
    drawCard(x, yPos, statCardWidth, 28);
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...stat.color);
    doc.text(stat.value, x + statCardWidth / 2, yPos + 14, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray500);
    doc.text(stat.label, x + statCardWidth / 2, yPos + 22, { align: 'center' });
  });

  yPos += 38;

  // ===== EXECUTIVE SUMMARY CARD =====
  if (analytics.insights?.summary) {
    const cleanSummary = analytics.insights.summary
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '');
    
    doc.setFontSize(9);
    const summaryLines = doc.splitTextToSize(cleanSummary, contentWidth - 20);
    const cardHeight = Math.min(80, Math.max(45, summaryLines.length * 4 + 30));
    
    checkPageBreak(cardHeight + 10);
    const cardY = drawCard(margin, yPos, contentWidth, cardHeight, 'Executive Summary', colors.primary);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray700);
    const displayLines = summaryLines.slice(0, 12);
    doc.text(displayLines, margin + 10, cardY + 4);
    
    yPos += cardHeight + 8;
  }

  // ===== TWO COLUMN LAYOUT: SENTIMENT & TOPICS =====
  checkPageBreak(110);
  const colWidth = (contentWidth - 10) / 2;

  // LEFT: Overall Climate Card
  const climateCardHeight = 95;
  const climateCardY = drawCard(margin, yPos, colWidth, climateCardHeight, 'Overall Climate', colors.green);
  
  const sentiment = analytics.sentiment?.overall;
  if (sentiment) {
    // Positivity Score - Donut Chart (smaller)
    const positivity = Math.round(sentiment.positive + sentiment.neutral * 0.5);
    const centerX = margin + colWidth / 2;
    const centerY = climateCardY + 16;
    const outerRadius = 14;
    const innerRadius = 9;
    
    // Outer colored ring (donut)
    const scoreColor = positivity >= 60 ? colors.green : positivity >= 40 ? colors.amber : colors.red;
    doc.setFillColor(...scoreColor);
    doc.circle(centerX, centerY, outerRadius, 'F');
    
    // Inner white circle (creates donut effect)
    doc.setFillColor(...colors.white);
    doc.circle(centerX, centerY, innerRadius, 'F');
    
    // Score number in center
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray800);
    doc.text(`${positivity}`, centerX, centerY + 4, { align: 'center' });
    
    // Sentiment breakdown bars - with more spacing
    const barStartY = centerY + 24;
    const barWidth = colWidth - 55;
    const sentimentItems = [
      { label: 'Positive', value: sentiment.positive, color: colors.green, icon: '+' },
      { label: 'Neutral', value: sentiment.neutral, color: colors.gray400, icon: '~' },
      { label: 'Negative', value: sentiment.negative, color: colors.red, icon: '-' },
    ];
    
    sentimentItems.forEach((item, i) => {
      const itemY = barStartY + i * 14;
      
      // Icon
      doc.setFontSize(11);
      doc.setTextColor(...item.color);
      doc.setFont('helvetica', 'bold');
      doc.text(item.icon, margin + 10, itemY + 3);
      
      // Label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.gray600);
      doc.text(item.label, margin + 18, itemY + 3);
      
      // Progress bar - wider
      drawProgressBar(margin + 42, itemY, barWidth, item.value, item.color);
      
      // Percentage - right aligned
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.gray800);
      doc.text(`${item.value}%`, margin + colWidth - 12, itemY + 3, { align: 'right' });
    });
  }

  // RIGHT: Top Topics Card
  const topicsCardX = margin + colWidth + 10;
  const topicsCardY = drawCard(topicsCardX, yPos, colWidth, climateCardHeight, 'Top Topics', colors.purple);
  
  const topics = analytics.topics?.topTopics || [];
  const topicRowHeight = 13;
  topics.slice(0, 5).forEach((topic, i) => {
    const itemY = topicsCardY + 6 + i * topicRowHeight;
    const dist = analytics.topics?.distribution?.[topic];
    const percentage = dist?.percentage || 0;
    
    // Topic pill - left side
    doc.setFillColor(...colors.purpleLight);
    doc.setFontSize(8);
    const displayTopic = topic.length > 18 ? topic.substring(0, 15) + '...' : topic;
    const topicWidth = doc.getTextWidth(displayTopic) + 10;
    doc.roundedRect(topicsCardX + 10, itemY - 5, topicWidth, 11, 3, 3, 'F');
    
    doc.setTextColor(...colors.purple);
    doc.setFont('helvetica', 'normal');
    doc.text(displayTopic, topicsCardX + 15, itemY + 2);
    
    // Percentage badge - right aligned
    const percText = `${percentage}%`;
    doc.setFillColor(...colors.gray100);
    const percWidth = doc.getTextWidth(percText) + 8;
    doc.roundedRect(topicsCardX + colWidth - percWidth - 12, itemY - 5, percWidth, 11, 3, 3, 'F');
    doc.setTextColor(...colors.gray600);
    doc.setFontSize(8);
    doc.text(percText, topicsCardX + colWidth - 16, itemY + 2, { align: 'right' });
  });

  yPos += climateCardHeight + 10;

  // ===== KEY FINDINGS CARD =====
  if (analytics.insights?.keyFindings?.length) {
    const findings = analytics.insights.keyFindings.slice(0, 4);
    const findingsHeight = 25 + findings.length * 22;
    
    checkPageBreak(findingsHeight + 10);
    const findingsY = drawCard(margin, yPos, contentWidth, findingsHeight, 'Key Findings', colors.amber);
    
    findings.forEach((f, i) => {
      const itemY = findingsY + 4 + i * 22;
      
      // Type indicator bar on left
      const typeColor = f.type === 'negative' ? colors.red : f.type === 'positive' ? colors.green : f.type === 'trend' ? colors.primary : colors.amber;
      doc.setFillColor(...typeColor);
      doc.roundedRect(margin + 8, itemY - 2, 3, 14, 1, 1, 'F');
      
      // Finding text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.gray800);
      const findingText = f.finding.length > 85 ? f.finding.substring(0, 82) + '...' : f.finding;
      doc.text(findingText, margin + 16, itemY + 5);
      
      // Badges row
      let badgeX = margin + 16;
      const badgeY = itemY + 14;
      
      // Confidence badge
      const confColor = f.confidence === 'high' ? colors.greenLight : f.confidence === 'medium' ? colors.amberLight : colors.gray100;
      const confTextColor = f.confidence === 'high' ? colors.green : f.confidence === 'medium' ? colors.amber : colors.gray600;
      badgeX += drawBadge(badgeX, badgeY, f.confidence.toUpperCase(), confColor, confTextColor);
      
      // Type badge
      if (f.type) {
        const typeBg = f.type === 'negative' ? colors.redLight : f.type === 'positive' ? colors.greenLight : colors.gray100;
        const typeText = f.type === 'negative' ? colors.red : f.type === 'positive' ? colors.green : colors.gray600;
        badgeX += drawBadge(badgeX, badgeY, f.type.toUpperCase(), typeBg, typeText);
      }
      
      // Response count
      doc.setFontSize(7);
      doc.setTextColor(...colors.gray400);
      doc.text(`${f.basedOnResponses} responses`, badgeX + 4, badgeY);
    });
    
    yPos += findingsHeight + 8;
  }

  // ===== RECOMMENDATIONS CARD =====
  if (analytics.insights?.recommendations?.length) {
    const recs = analytics.insights.recommendations.slice(0, 3);
    const recsHeight = 25 + recs.length * 28;
    
    checkPageBreak(recsHeight + 10);
    const recsY = drawCard(margin, yPos, contentWidth, recsHeight, 'Recommendations', colors.primary);
    
    recs.forEach((r, i) => {
      const itemY = recsY + 4 + i * 28;
      
      // Priority colors
      const prioColor = r.priority === 'urgent' ? colors.red : r.priority === 'important' ? colors.amber : colors.green;
      const prioBg = r.priority === 'urgent' ? colors.redLight : r.priority === 'important' ? colors.amberLight : colors.greenLight;
      
      // Background for recommendation
      doc.setFillColor(...prioBg);
      doc.roundedRect(margin + 8, itemY - 4, contentWidth - 20, 24, 2, 2, 'F');
      
      // Priority indicator bar
      doc.setFillColor(...prioColor);
      doc.roundedRect(margin + 8, itemY - 4, 3, 24, 1, 1, 'F');
      
      // Recommendation text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.gray800);
      const recText = r.recommendation.length > 70 ? r.recommendation.substring(0, 67) + '...' : r.recommendation;
      doc.text(recText, margin + 16, itemY + 4);
      
      // Action text
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.gray600);
      const actionText = r.suggestedAction.length > 85 ? r.suggestedAction.substring(0, 82) + '...' : r.suggestedAction;
      doc.text(actionText, margin + 16, itemY + 13);
      
      // Priority badge on right
      doc.setFillColor(...prioColor);
      const prioLabel = r.priority.toUpperCase();
      doc.setFontSize(7);
      const prioBadgeWidth = doc.getTextWidth(prioLabel) + 6;
      doc.roundedRect(contentWidth - prioBadgeWidth + 5, itemY - 2, prioBadgeWidth, 10, 2, 2, 'F');
      doc.setTextColor(...colors.white);
      doc.setFont('helvetica', 'bold');
      doc.text(prioLabel, contentWidth - prioBadgeWidth + 8, itemY + 4);
    });
    
    yPos += recsHeight + 8;
  }

  // ===== TREND ANALYSIS =====
  if (analytics.trendAnalysis?.hasEnoughData) {
    const trends = analytics.trendAnalysis;
    const hasTrends = (trends.emergingTopics?.length || 0) + (trends.sentimentShifts?.length || 0) > 0;
    
    if (hasTrends) {
      const trendCount = Math.min(2, trends.emergingTopics?.length || 0) + Math.min(2, trends.sentimentShifts?.length || 0);
      const trendsHeight = 25 + trendCount * 12;
      
      checkPageBreak(trendsHeight + 10);
      const trendsY = drawCard(margin, yPos, contentWidth, trendsHeight, 'Trend Analysis', colors.primaryDark);
      
      let trendItemY = trendsY + 4;
      
      // Emerging topics
      trends.emergingTopics?.slice(0, 2).forEach((t) => {
        doc.setFontSize(10);
        doc.setTextColor(...colors.green);
        doc.text('▲', margin + 10, trendItemY + 3);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.gray700);
        const desc = t.description.length > 95 ? t.description.substring(0, 92) + '...' : t.description;
        doc.text(desc, margin + 18, trendItemY + 3);
        trendItemY += 10;
      });
      
      // Sentiment shifts
      trends.sentimentShifts?.slice(0, 2).forEach((s) => {
        doc.setFontSize(10);
        const arrowColor = s.direction === 'improving' ? colors.green : colors.red;
        doc.setTextColor(...arrowColor);
        doc.text(s.direction === 'improving' ? '▲' : '▼', margin + 10, trendItemY + 3);
        
        doc.setFontSize(8);
        doc.setTextColor(...colors.gray700);
        const desc = s.description.length > 95 ? s.description.substring(0, 92) + '...' : s.description;
        doc.text(desc, margin + 18, trendItemY + 3);
        trendItemY += 10;
      });
      
      yPos += trendsHeight + 8;
    }
  }

  // ===== REPRESENTATIVE QUOTES =====
  if (analytics.quotes?.representative?.length) {
    const quotes = analytics.quotes.representative.slice(0, 2);
    
    // Calculate height based on text wrapping
    doc.setFontSize(9);
    let totalQuotesHeight = 28;
    const quoteBoxes: { lines: string[]; height: number }[] = [];
    
    quotes.forEach((q) => {
      const quoteLines = doc.splitTextToSize(q.text, contentWidth - 45);
      const displayLines = quoteLines.slice(0, 3); // Max 3 lines per quote
      const boxHeight = displayLines.length * 5 + 18;
      quoteBoxes.push({ lines: displayLines, height: boxHeight });
      totalQuotesHeight += boxHeight + 6;
    });
    
    checkPageBreak(totalQuotesHeight + 10);
    const quotesY = drawCard(margin, yPos, contentWidth, totalQuotesHeight, 'What People Say', colors.gray600);
    
    let quoteY = quotesY + 6;
    quotes.forEach((q, i) => {
      const box = quoteBoxes[i];
      
      // Quote background
      doc.setFillColor(...colors.gray50);
      doc.roundedRect(margin + 10, quoteY - 2, contentWidth - 24, box.height, 3, 3, 'F');
      
      // Quote mark
      doc.setFontSize(18);
      doc.setTextColor(...colors.gray300);
      doc.text('"', margin + 14, quoteY + 8);
      
      // Quote text - wrapped
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...colors.gray700);
      doc.text(box.lines, margin + 24, quoteY + 6);
      
      // Sentiment & topics metadata
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...colors.gray400);
      const meta = `${q.sentiment || 'neutral'} • ${q.topics?.slice(0, 2).join(', ') || 'general'}`;
      doc.text(meta, margin + 24, quoteY + box.height - 6);
      
      quoteY += box.height + 6;
    });
    
    yPos += totalQuotesHeight + 8;
  }


  // ===== FOOTER ON ALL PAGES =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(...colors.gray200);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    
    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(...colors.gray400);
    doc.text('FormulAI Analytics Report', margin, pageHeight - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 6);
  }

  // Save the PDF
  const fileName = `${form.title.replace(/[^a-z0-9]/gi, '_')}_analytics_report.pdf`;
  doc.save(fileName);
}
