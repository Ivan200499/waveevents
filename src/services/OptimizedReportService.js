import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function generateOptimizedReport() {
  try {
    console.log('Inizio generazione report ottimizzato...');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Colori
    const colors = {
      primary: [41, 128, 185], // Blu
      secondary: [39, 174, 96], // Verde
      accent: [155, 89, 182], // Viola
      headerBg: [52, 73, 94], // Blu scuro
      tableBg: [236, 240, 241], // Grigio chiaro
      eventColor: [230, 126, 34], // Arancione
      promoterColor: [231, 76, 60], // Rosso
    };

    // Funzione helper per aggiungere testo centrato
    const addCenteredText = (text, y, fontSize = 12, color = [0, 0, 0]) => {
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
      const x = (pageWidth - textWidth) / 2;
      doc.text(text, x, y);
      return y + fontSize / 2;
    };

    // Funzione helper per aggiungere una sezione
    const addSection = (title, y, color = colors.primary) => {
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(10, y, pageWidth - 20, 10, 'F');
      doc.text(title, 15, y + 7);
      doc.setTextColor(0, 0, 0);
      return y + 15;
    };

    // Funzione per aggiungere nuova pagina se necessario
    const checkNewPage = (yPosition, threshold = 230) => {
      if (yPosition > threshold) {
        doc.addPage();
        return 20; // Reset della posizione Y
      }
      return yPosition;
    };

    // Funzione per troncare testo lungo
    const truncateText = (text, maxLength = 25) => {
      if (!text) return 'N/A';
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    // Intestazione con stile
    doc.setFillColor(colors.headerBg[0], colors.headerBg[1], colors.headerBg[2]);
    doc.rect(0, 0, pageWidth, 40, 'F');

    let yPosition = addCenteredText('Report Statistiche Dettagliato', 20, 24, [255, 255, 255]);
    yPosition = addCenteredText(`Generato il ${new Date().toLocaleDateString()}`, 30, 12, [255, 255, 255]);
    yPosition = 50;

    // 1. Riepilogo Generale
    console.log('Generazione riepilogo generale...');
    yPosition = addSection('1. Riepilogo Generale', yPosition);
    
    // Recupera tutti i biglietti
    const ticketsQuery = query(collection(db, 'tickets'));
    const ticketsSnapshot = await getDocs(ticketsQuery);
    let tickets = ticketsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Calcola statistiche generali
    let totalTickets = tickets.reduce((acc, ticket) => acc + (ticket.quantity || 0), 0);
    let totalRevenue = tickets.reduce((acc, ticket) => acc + (ticket.totalPrice || 0), 0);
    let totalEvents = new Set(tickets.map(ticket => ticket.eventId)).size;
    let totalSellers = new Set(tickets.map(ticket => ticket.sellerId)).size;

    // Statistiche generali in tabella
    const generalStatsData = [
      ['Metrica', 'Valore'],
      ['Totale Biglietti Venduti', totalTickets.toString()],
      ['Ricavo Totale', `€${totalRevenue.toFixed(2)}`],
      ['Media Prezzo per Biglietto', `€${(totalRevenue / totalTickets).toFixed(2)}`],
      ['Numero Eventi', totalEvents.toString()],
      ['Numero Venditori', totalSellers.toString()],
      ['Numero Transazioni', `${tickets.length}`]
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [generalStatsData[0]],
      body: generalStatsData.slice(1),
      theme: 'grid',
      headStyles: {
        fillColor: colors.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: colors.tableBg
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = doc.lastAutoTable.finalY + 15;
    yPosition = checkNewPage(yPosition);

    // 1.1 Statistiche per Evento
    console.log('Generazione statistiche per evento...');
    yPosition = addSection('1.1 Statistiche per Evento', yPosition, colors.eventColor);

    // Raggruppa le vendite per evento
    const eventStats = tickets.reduce((acc, ticket) => {
      const eventId = ticket.eventId;
      if (!eventId) return acc;
      
      if (!acc[eventId]) {
        acc[eventId] = {
          eventId,
          eventName: ticket.eventName || 'Evento senza nome',
          totalTickets: 0,
          totalRevenue: 0,
          transactions: 0,
          sellerId: new Set(),
          dates: new Set()
        };
      }
      
      acc[eventId].totalTickets += ticket.quantity || 0;
      acc[eventId].totalRevenue += ticket.totalPrice || 0;
      acc[eventId].transactions += 1;
      acc[eventId].sellerId.add(ticket.sellerId);
      if (ticket.createdAt) {
        acc[eventId].dates.add(new Date(ticket.createdAt).toLocaleDateString());
      }
      
      return acc;
    }, {});

    // Converti in array e ordina per ricavo
    const eventStatsArray = Object.values(eventStats)
      .map(event => ({
        ...event,
        sellerCount: event.sellerId.size,
        dateCount: event.dates.size
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Crea tabella per eventi
    const eventTableHead = [['Evento', 'Biglietti', 'Ricavo', 'Venditori', '% Totale']];
    const eventTableBody = eventStatsArray.map(event => [
      truncateText(event.eventName, 20),
      event.totalTickets.toString(),
      `€${event.totalRevenue.toFixed(2)}`,
      event.sellerCount.toString(),
      `${((event.totalRevenue / totalRevenue) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: eventTableHead,
      body: eventTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: colors.eventColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [255, 248, 240] // Arancione chiaro
      },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 60 }, // Evento
        1: { cellWidth: 25 }, // Biglietti
        2: { cellWidth: 30 }, // Ricavo
        3: { cellWidth: 25 }, // Venditori
        4: { cellWidth: 25 }, // % Totale
      },
    });

    // 2. Statistiche per Manager con dettagli più estesi
    console.log('Generazione statistiche gerarchiche dettagliate...');
    doc.addPage();
    yPosition = 20;
    yPosition = addSection('2. Struttura Gerarchica', yPosition);
    
    // Recupera tutti i manager
    const managersQuery = query(collection(db, 'users'), where('role', '==', 'manager'));
    const managersSnapshot = await getDocs(managersQuery);
    const managers = managersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (managers.length === 0) {
      doc.text('Nessun manager trovato nel sistema.', 15, yPosition);
      yPosition += 10;
    } else {
      // Crea tabella riassuntiva manager
      const managerSummaryHead = [['Manager', 'Team Leader', 'Promoter', 'Biglietti', 'Ricavo']];
      const managerSummaryRows = [];
      
      // Per ogni manager
      for (const manager of managers) {
        // Recupera i team leader del manager
        const teamLeadersQuery = query(
          collection(db, 'users'),
          where('managerId', '==', manager.id),
          where('role', '==', 'teamLeader')
        );
        const teamLeadersSnapshot = await getDocs(teamLeadersQuery);
        const teamLeaders = teamLeadersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Raccoglie dati per il riepilogo manager
        let managerTotalTickets = 0;
        let managerTotalRevenue = 0;
        let managerTotalPromoters = 0;
        
        // Per ogni team leader
        for (const leader of teamLeaders) {
          // Recupera i promoter del team leader
          const promotersQuery = query(
            collection(db, 'users'),
            where('teamLeaderId', '==', leader.id),
            where('role', '==', 'promoter')
          );
          const promotersSnapshot = await getDocs(promotersQuery);
          const promoters = promotersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          managerTotalPromoters += promoters.length;
          
          // Calcola le vendite del team
          let leaderTotalTickets = 0;
          let leaderTotalRevenue = 0;
          
          // Vendite dirette del team leader
          const leaderTicketsQuery = query(
            collection(db, 'tickets'),
            where('sellerId', '==', leader.id)
          );
          const leaderTicketsSnapshot = await getDocs(leaderTicketsQuery);
          
          leaderTicketsSnapshot.docs.forEach(doc => {
            const ticket = doc.data();
            leaderTotalTickets += ticket.quantity || 0;
            leaderTotalRevenue += ticket.totalPrice || 0;
          });
          
          // Vendite dei promoter
          for (const promoter of promoters) {
            const promoterTicketsQuery = query(
              collection(db, 'tickets'),
              where('sellerId', '==', promoter.id)
            );
            const promoterTicketsSnapshot = await getDocs(promoterTicketsQuery);
            
            promoterTicketsSnapshot.docs.forEach(doc => {
              const ticket = doc.data();
              leaderTotalTickets += ticket.quantity || 0;
              leaderTotalRevenue += ticket.totalPrice || 0;
            });
          }
          
          managerTotalTickets += leaderTotalTickets;
          managerTotalRevenue += leaderTotalRevenue;
        }
        
        // Aggiungi riga alla tabella manager
        managerSummaryRows.push([
          truncateText(manager.name || manager.email || 'Senza nome', 15),
          teamLeaders.length.toString(),
          managerTotalPromoters.toString(),
          managerTotalTickets.toString(),
          `€${managerTotalRevenue.toFixed(2)}`
        ]);
      }
      
      // Tabella riassuntiva manager
      autoTable(doc, {
        startY: yPosition,
        head: managerSummaryHead,
        body: managerSummaryRows,
        theme: 'grid',
        headStyles: {
          fillColor: colors.primary,
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: colors.tableBg
        },
        margin: { left: 15, right: 15 },
      });
      
      yPosition = doc.lastAutoTable.finalY + 20;
      
      // Dettagli per ogni manager
      for (const manager of managers) {
        doc.addPage();
        let managerYPos = 20;
        
        // Intestazione manager
        managerYPos = addSection(`Manager: ${truncateText(manager.name || manager.email || 'Senza nome', 30)}`, managerYPos, colors.primary);
        
        // Recupera i team leader del manager
        const teamLeadersQuery = query(
          collection(db, 'users'),
          where('managerId', '==', manager.id),
          where('role', '==', 'teamLeader')
        );
        const teamLeadersSnapshot = await getDocs(teamLeadersQuery);
        const teamLeaders = teamLeadersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Dati del manager
        const managerEventStats = {};
        let managerTotalTickets = 0;
        let managerTotalRevenue = 0;
        let managerTotalPromoters = 0;
        
        // Tabella dei team leader di questo manager
        const teamLeaderHead = [['Team Leader', 'Promoter', 'Biglietti', 'Ricavo']];
        const teamLeaderRows = [];
        
        // Per ogni team leader
        for (const leader of teamLeaders) {
          const promotersQuery = query(
            collection(db, 'users'),
            where('teamLeaderId', '==', leader.id),
            where('role', '==', 'promoter')
          );
          const promotersSnapshot = await getDocs(promotersQuery);
          const promoters = promotersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          managerTotalPromoters += promoters.length;
          
          // Calcola statistiche del team leader
          let leaderTotalTickets = 0;
          let leaderTotalRevenue = 0;
          
          // Vendite dirette del team leader
          const leaderTicketsQuery = query(
            collection(db, 'tickets'),
            where('sellerId', '==', leader.id)
          );
          const leaderTicketsSnapshot = await getDocs(leaderTicketsQuery);
          
          leaderTicketsSnapshot.docs.forEach(doc => {
            const ticket = doc.data();
            const eventId = ticket.eventId;
            const eventName = ticket.eventName || 'Evento senza nome';
            const quantity = ticket.quantity || 0;
            const revenue = ticket.totalPrice || 0;
            
            leaderTotalTickets += quantity;
            leaderTotalRevenue += revenue;
            
            // Registra per evento
            if (eventId) {
              if (!managerEventStats[eventId]) {
                managerEventStats[eventId] = { eventName, tickets: 0, revenue: 0 };
              }
              managerEventStats[eventId].tickets += quantity;
              managerEventStats[eventId].revenue += revenue;
            }
          });
          
          // Vendite dei promoter
          for (const promoter of promoters) {
            const promoterTicketsQuery = query(
              collection(db, 'tickets'),
              where('sellerId', '==', promoter.id)
            );
            const promoterTicketsSnapshot = await getDocs(promoterTicketsQuery);
            
            promoterTicketsSnapshot.docs.forEach(doc => {
              const ticket = doc.data();
              const eventId = ticket.eventId;
              const eventName = ticket.eventName || 'Evento senza nome';
              const quantity = ticket.quantity || 0;
              const revenue = ticket.totalPrice || 0;
              
              leaderTotalTickets += quantity;
              leaderTotalRevenue += revenue;
              
              // Registra per evento
              if (eventId) {
                if (!managerEventStats[eventId]) {
                  managerEventStats[eventId] = { eventName, tickets: 0, revenue: 0 };
                }
                managerEventStats[eventId].tickets += quantity;
                managerEventStats[eventId].revenue += revenue;
              }
            });
          }
          
          // Aggiungi riga alla tabella team leader
          teamLeaderRows.push([
            truncateText(leader.name || leader.email || 'Senza nome', 15),
            promoters.length.toString(),
            leaderTotalTickets.toString(),
            `€${leaderTotalRevenue.toFixed(2)}`
          ]);
          
          managerTotalTickets += leaderTotalTickets;
          managerTotalRevenue += leaderTotalRevenue;
          
          // Pagina per ogni team leader
          doc.addPage();
          let leaderYPos = 20;
          
          // Intestazione team leader
          leaderYPos = addSection(`Team Leader: ${truncateText(leader.name || leader.email || 'Senza nome', 30)}`, leaderYPos, colors.secondary);
          
          // Info team leader
          doc.setFontSize(12);
          doc.text(`Email: ${leader.email || 'N/A'}`, 15, leaderYPos);
          leaderYPos += 7;
          doc.text(`Manager: ${truncateText(manager.name || manager.email || 'Senza nome', 30)}`, 15, leaderYPos);
          leaderYPos += 10;
          doc.text(`Totale Promoter: ${promoters.length}`, 15, leaderYPos);
          leaderYPos += 7;
          doc.text(`Totale Biglietti: ${leaderTotalTickets}`, 15, leaderYPos);
          leaderYPos += 7;
          doc.text(`Totale Ricavi: €${leaderTotalRevenue.toFixed(2)}`, 15, leaderYPos);
          leaderYPos += 15;
          
          // Tabella promoter del team leader
          if (promoters.length > 0) {
            const promoterSummaryHead = [['Promoter', 'Biglietti', 'Ricavo', '% del Team']];
            const promoterSummaryRows = [];
            
            for (const promoter of promoters) {
              const promoterTicketsQuery = query(
                collection(db, 'tickets'),
                where('sellerId', '==', promoter.id)
              );
              const promoterTicketsSnapshot = await getDocs(promoterTicketsQuery);
              
              let promoterTotalTickets = 0;
              let promoterTotalRevenue = 0;
              
              promoterTicketsSnapshot.docs.forEach(doc => {
                const ticket = doc.data();
                promoterTotalTickets += ticket.quantity || 0;
                promoterTotalRevenue += ticket.totalPrice || 0;
              });
              
              const percentOfTeam = leaderTotalRevenue > 0 
                ? ((promoterTotalRevenue / leaderTotalRevenue) * 100).toFixed(1) 
                : '0.0';
              
              promoterSummaryRows.push([
                truncateText(promoter.name || promoter.email || 'Senza nome', 15),
                promoterTotalTickets.toString(),
                `€${promoterTotalRevenue.toFixed(2)}`,
                `${percentOfTeam}%`
              ]);
              
              // Crea pagina dettagliata per ogni promoter con vendite
              if (promoterTotalTickets > 0) {
                // Recupera vendite per evento del promoter
                const promoterEventStats = {};
                
                promoterTicketsSnapshot.docs.forEach(doc => {
                  const ticket = doc.data();
                  const eventId = ticket.eventId;
                  const eventName = ticket.eventName || 'Evento senza nome';
                  const quantity = ticket.quantity || 0;
                  const revenue = ticket.totalPrice || 0;
                  
                  if (!promoterEventStats[eventId]) {
                    promoterEventStats[eventId] = { eventName, tickets: 0, revenue: 0 };
                  }
                  promoterEventStats[eventId].tickets += quantity;
                  promoterEventStats[eventId].revenue += revenue;
                });
                
                // Crea pagina per promoter 
                doc.addPage();
                let promoterYPos = 20;
                
                // Intestazione promoter
                promoterYPos = addSection(`Promoter: ${truncateText(promoter.name || promoter.email || 'Senza nome', 30)}`, promoterYPos, colors.promoterColor);
                
                // Info promoter
                doc.setFontSize(12);
                doc.text(`Email: ${promoter.email || 'N/A'}`, 15, promoterYPos);
                promoterYPos += 7;
                doc.text(`Team Leader: ${truncateText(leader.name || leader.email || 'Senza nome', 30)}`, 15, promoterYPos);
                promoterYPos += 7;
                doc.text(`Manager: ${truncateText(manager.name || manager.email || 'Senza nome', 30)}`, 15, promoterYPos);
                promoterYPos += 10;
                doc.text(`Totale Biglietti: ${promoterTotalTickets}`, 15, promoterYPos);
                promoterYPos += 7;
                doc.text(`Totale Ricavi: €${promoterTotalRevenue.toFixed(2)}`, 15, promoterYPos);
                promoterYPos += 15;
                
                // Tabella eventi del promoter
                const promoterEventList = Object.values(promoterEventStats).sort((a, b) => b.revenue - a.revenue);
                
                if (promoterEventList.length > 0) {
                  const promoterEventHead = [['Evento', 'Biglietti', 'Ricavo', '% del Tot']];
                  const promoterEventRows = promoterEventList.map(event => [
                    truncateText(event.eventName, 20),
                    event.tickets.toString(),
                    `€${event.revenue.toFixed(2)}`,
                    `${promoterTotalRevenue > 0 ? ((event.revenue / promoterTotalRevenue) * 100).toFixed(1) : '0.0'}%`
                  ]);
                  
                  autoTable(doc, {
                    startY: promoterYPos,
                    head: promoterEventHead,
                    body: promoterEventRows,
                    theme: 'grid',
                    headStyles: {
                      fillColor: colors.promoterColor,
                      textColor: [255, 255, 255],
                      fontStyle: 'bold'
                    },
                    alternateRowStyles: {
                      fillColor: [255, 236, 236] // Rosso chiaro
                    },
                    margin: { left: 15, right: 15 },
                    columnStyles: {
                      0: { cellWidth: 65 }, // Evento
                      1: { cellWidth: 30 }, // Biglietti
                      2: { cellWidth: 35 }, // Ricavo
                      3: { cellWidth: 35 }  // % del Tot
                    },
                  });
                }
              }
            }
            
            autoTable(doc, {
              startY: leaderYPos,
              head: promoterSummaryHead,
              body: promoterSummaryRows,
              theme: 'grid',
              headStyles: {
                fillColor: colors.secondary,
                textColor: [255, 255, 255],
                fontStyle: 'bold'
              },
              alternateRowStyles: {
                fillColor: [232, 246, 237] // Verde chiaro
              },
              margin: { left: 15, right: 15 },
              columnStyles: {
                0: { cellWidth: 60 }, // Promoter
                1: { cellWidth: 40 }, // Biglietti
                2: { cellWidth: 40 }, // Ricavo
                3: { cellWidth: 35 }  // % del Team
              },
            });
          }
        }
        
        // Tabella team leader
        autoTable(doc, {
          startY: managerYPos + 10,
          head: teamLeaderHead,
          body: teamLeaderRows,
          theme: 'grid',
          headStyles: {
            fillColor: colors.primary,
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: colors.tableBg
          },
          margin: { left: 15, right: 15 },
          columnStyles: {
            0: { cellWidth: 65 }, // Team Leader
            1: { cellWidth: 30 }, // Promoter
            2: { cellWidth: 40 }, // Biglietti
            3: { cellWidth: 40 }  // Ricavo
          },
        });
        
        managerYPos = doc.lastAutoTable.finalY + 15;
        
        // Info manager
        doc.setFontSize(12);
        doc.text(`Totale Team Leader: ${teamLeaders.length}`, 15, managerYPos);
        managerYPos += 7;
        doc.text(`Totale Promoter: ${managerTotalPromoters}`, 15, managerYPos);
        managerYPos += 7;
        doc.text(`Totale Biglietti: ${managerTotalTickets}`, 15, managerYPos);
        managerYPos += 7;
        doc.text(`Totale Ricavi: €${managerTotalRevenue.toFixed(2)}`, 15, managerYPos);
        managerYPos += 15;
        
        // Tabella eventi del manager
        managerYPos = checkNewPage(managerYPos);
        managerYPos = addSection('Eventi del Manager', managerYPos, colors.primary);
        
        const managerEventList = Object.values(managerEventStats).sort((a, b) => b.revenue - a.revenue);
        
        if (managerEventList.length > 0) {
          const managerEventHead = [['Evento', 'Biglietti', 'Ricavo', '% del Tot']];
          const managerEventRows = managerEventList.map(event => [
            truncateText(event.eventName, 20),
            event.tickets.toString(),
            `€${event.revenue.toFixed(2)}`,
            `${managerTotalRevenue > 0 ? ((event.revenue / managerTotalRevenue) * 100).toFixed(1) : '0.0'}%`
          ]);
          
          autoTable(doc, {
            startY: managerYPos,
            head: managerEventHead,
            body: managerEventRows,
            theme: 'grid',
            headStyles: {
              fillColor: colors.primary,
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            alternateRowStyles: {
              fillColor: colors.tableBg
            },
            margin: { left: 15, right: 15 },
            columnStyles: {
              0: { cellWidth: 65 }, // Evento
              1: { cellWidth: 35 }, // Biglietti
              2: { cellWidth: 35 }, // Ricavo
              3: { cellWidth: 35 }  // % del Tot
            },
          });
        }
      }
    }

    // Footer su ogni pagina
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Pagina ${i} di ${totalPages}`, pageWidth - 40, doc.internal.pageSize.height - 10);
      doc.text(`Report Statistiche - ${new Date().toLocaleDateString()}`, 15, doc.internal.pageSize.height - 10);
    }

    // Salva il PDF
    doc.save('statistiche_ottimizzate.pdf');
    console.log('Report ottimizzato generato con successo');
    return true;
  } catch (error) {
    console.error('Errore nella generazione del report:', error);
    throw error;
  }
} 