import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function generateGlobalStatisticsPDF() {
  try {
    console.log('Inizio generazione report...');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

    // Colori
    const colors = {
      primary: [41, 128, 185], // Blu
      secondary: [39, 174, 96], // Verde
      accent: [155, 89, 182], // Viola
      headerBg: [52, 73, 94], // Blu scuro
      tableBg: [236, 240, 241], // Grigio chiaro
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
    const checkNewPage = (yPosition, threshold = 250) => {
      if (yPosition > threshold) {
        doc.addPage();
        return 20; // Reset della posizione Y
      }
      return yPosition;
    };

    // Intestazione con logo
    doc.setFillColor(colors.headerBg[0], colors.headerBg[1], colors.headerBg[2]);
    doc.rect(0, 0, pageWidth, 40, 'F');

    let yPosition = addCenteredText('Report Statistiche Globali', 20, 24, [255, 255, 255]);
    yPosition = addCenteredText(`Generato il ${new Date().toLocaleDateString()}`, 30, 12, [255, 255, 255]);
    yPosition = 50;

    // 1. Riepilogo Generale
    console.log('Generazione riepilogo generale...');
    yPosition = addSection('1. Riepilogo Generale', yPosition);
    
    // Recupera statistiche generali
    const ticketsQuery = query(collection(db, 'tickets'));
    const ticketsSnapshot = await getDocs(ticketsQuery);
    let tickets = ticketsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    let totalTickets = tickets.reduce((acc, ticket) => acc + (ticket.quantity || 0), 0);
    let totalRevenue = tickets.reduce((acc, ticket) => acc + (ticket.totalPrice || 0), 0);

    // Statistiche generali in tabella
    const generalStatsData = [
      ['Metrica', 'Valore'],
      ['Totale Biglietti Venduti', totalTickets.toString()],
      ['Ricavo Totale', `€${totalRevenue.toFixed(2)}`],
      ['Media Prezzo per Biglietto', `€${(totalRevenue / totalTickets).toFixed(2)}`],
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
      }
    });

    yPosition = doc.lastAutoTable.finalY + 15;
    yPosition = checkNewPage(yPosition);

    // Statistiche per Evento
    console.log('Generazione statistiche per evento...');
    yPosition = addSection('1.1 Statistiche per Evento', yPosition, colors.secondary);

    // Raggruppa le vendite per evento
    const eventStats = tickets.reduce((acc, ticket) => {
      const eventId = ticket.eventId;
      if (!acc[eventId]) {
        acc[eventId] = {
          eventName: ticket.eventName,
          totalTickets: 0,
          totalRevenue: 0,
          transactions: 0
        };
      }
      
      acc[eventId].totalTickets += ticket.quantity || 0;
      acc[eventId].totalRevenue += ticket.totalPrice || 0;
      acc[eventId].transactions += 1;
      
      return acc;
    }, {});

    // Converti in array e ordina per ricavo
    const eventStatsArray = Object.values(eventStats)
      .filter(event => event.eventName) // Filtra eventi senza nome
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Crea tabella per eventi
    const eventTableHead = [['Evento', 'Biglietti', 'Ricavo', 'Transazioni', '% del Totale']];
    const eventTableBody = eventStatsArray.map(event => [
      event.eventName,
      event.totalTickets.toString(),
      `€${event.totalRevenue.toFixed(2)}`,
      event.transactions.toString(),
      `${((event.totalRevenue / totalRevenue) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: eventTableHead,
      body: eventTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: colors.secondary,
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: colors.tableBg
      }
    });

    yPosition = doc.lastAutoTable.finalY + 15;
    yPosition = checkNewPage(yPosition);

    // 2. Statistiche per Manager
    console.log('Generazione statistiche manager...');
    yPosition = addSection('2. Statistiche per Manager', yPosition);
    
    // Recupera tutti i manager
    const managersQuery = query(collection(db, 'users'), where('role', '==', 'manager'));
    const managersSnapshot = await getDocs(managersQuery);
    const managers = managersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (managers.length === 0) {
      doc.text('Nessun manager trovato nel sistema.', 15, yPosition);
      yPosition += 10;
    } else {
      // Crea una tabella riassuntiva per tutti i manager
      const managerSummaryHead = [['Manager', 'Team Leader', 'Promoter', 'Biglietti', 'Ricavo', '% del Totale']];
      const managerSummaryRows = [];

    for (const manager of managers) {
        // Recupera i team leader del manager
      const teamLeadersQuery = query(
        collection(db, 'users'),
        where('managerId', '==', manager.id),
        where('role', '==', 'teamLeader')
      );
      const teamLeadersSnapshot = await getDocs(teamLeadersQuery);
      const teamLeaders = teamLeadersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Calcola statistiche del manager
      let managerTotalTickets = 0;
      let managerTotalRevenue = 0;
        let totalPromoters = 0;

        // Per ogni team leader, recupera le statistiche
        for (const leader of teamLeaders) {
          // Recupera i promoter del team leader
        const promotersQuery = query(
          collection(db, 'users'),
            where('teamLeaderId', '==', leader.id),
          where('role', '==', 'promoter')
        );
        const promotersSnapshot = await getDocs(promotersQuery);
          const promoters = promotersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          totalPromoters += promoters.length;

          // Recupera le vendite del team leader
          const leaderTicketsQuery = query(
            collection(db, 'tickets'),
            where('sellerId', '==', leader.id)
          );
          const leaderTicketsSnapshot = await getDocs(leaderTicketsQuery);
          
          leaderTicketsSnapshot.docs.forEach(doc => {
            const ticket = doc.data();
            managerTotalTickets += ticket.quantity || 0;
            managerTotalRevenue += ticket.totalPrice || 0;
          });

          // Recupera le vendite dei promoter
          for (const promoter of promoters) {
            const promoterTicketsQuery = query(
              collection(db, 'tickets'),
              where('sellerId', '==', promoter.id)
            );
            const promoterTicketsSnapshot = await getDocs(promoterTicketsQuery);
            
            promoterTicketsSnapshot.docs.forEach(doc => {
              const ticket = doc.data();
              managerTotalTickets += ticket.quantity || 0;
              managerTotalRevenue += ticket.totalPrice || 0;
            });
          }
        }

        managerSummaryRows.push([
          manager.name || manager.email || 'Senza nome',
          teamLeaders.length.toString(),
          totalPromoters.toString(),
          managerTotalTickets.toString(),
          `€${managerTotalRevenue.toFixed(2)}`,
          `${((managerTotalRevenue / totalRevenue) * 100).toFixed(1)}%`
        ]);

        // Dettagli manager
        doc.addPage();
        yPosition = 20;
        yPosition = addSection(`Dettagli Manager: ${manager.name || manager.email || 'Senza nome'}`, yPosition, colors.accent);
        
        // Info manager
        doc.setFontSize(12);
        doc.text(`Email: ${manager.email || 'N/A'}`, 15, yPosition);
        yPosition += 7;
        doc.text(`Totale Biglietti: ${managerTotalTickets}`, 15, yPosition);
        yPosition += 7;
        doc.text(`Totale Ricavi: €${managerTotalRevenue.toFixed(2)}`, 15, yPosition);
        yPosition += 7;
        doc.text(`Team Leader: ${teamLeaders.length}`, 15, yPosition);
        yPosition += 7;
        doc.text(`Promoter: ${totalPromoters}`, 15, yPosition);
        yPosition += 15;

        // Tabella team leader
        if (teamLeaders.length > 0) {
          const teamLeaderHead = [['Team Leader', 'Promoter', 'Biglietti', 'Ricavo', '% del Manager']];
    const teamLeaderRows = [];

          for (const leader of teamLeaders) {
            // Recupera i promoter del team leader
        const promotersQuery = query(
          collection(db, 'users'),
              where('teamLeaderId', '==', leader.id),
          where('role', '==', 'promoter')
        );
        const promotersSnapshot = await getDocs(promotersQuery);
        const promoters = promotersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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

            const percentOfManager = managerTotalRevenue > 0 
              ? ((leaderTotalRevenue / managerTotalRevenue) * 100).toFixed(1) 
              : '0.0';

        teamLeaderRows.push([
              leader.name || leader.email || 'Senza nome',
              promoters.length.toString(),
              leaderTotalTickets.toString(),
              `€${leaderTotalRevenue.toFixed(2)}`,
              `${percentOfManager}%`
            ]);

            // Dettagli promoter
            if (promoters.length > 0) {
              const promoterHead = [['Promoter', 'Biglietti', 'Ricavo', '% del Team']];
        const promoterRows = [];

        for (const promoter of promoters) {
                const promoterTicketsQuery = query(
                  collection(db, 'tickets'),
                  where('sellerId', '==', promoter.id)
                );
                const promoterTicketsSnapshot = await getDocs(promoterTicketsQuery);
          
          let promoterTotalTickets = 0;
          let promoterTotalRevenue = 0;
          
                // Raggruppa per evento
                const promoterEventStats = {};
                
                promoterTicketsSnapshot.docs.forEach(doc => {
            const ticket = doc.data();
            promoterTotalTickets += ticket.quantity || 0;
            promoterTotalRevenue += ticket.totalPrice || 0;
                  
                  // Aggiungi dati dell'evento
                  if (ticket.eventId && ticket.eventName) {
                    if (!promoterEventStats[ticket.eventId]) {
                      promoterEventStats[ticket.eventId] = {
                        eventName: ticket.eventName,
                        tickets: 0,
                        revenue: 0
                      };
                    }
                    promoterEventStats[ticket.eventId].tickets += ticket.quantity || 0;
                    promoterEventStats[ticket.eventId].revenue += ticket.totalPrice || 0;
                  }
                });

                const percentOfTeam = leaderTotalRevenue > 0 
                  ? ((promoterTotalRevenue / leaderTotalRevenue) * 100).toFixed(1) 
                  : '0.0';

          promoterRows.push([
                  promoter.name || promoter.email || 'Senza nome',
                  promoterTotalTickets.toString(),
                  `€${promoterTotalRevenue.toFixed(2)}`,
                  `${percentOfTeam}%`
                ]);
                
                // Aggiungi dettagli eventi per questo promoter
                const promoterEventList = Object.values(promoterEventStats);
                if (promoterEventList.length > 0) {
                  // Ordina per ricavo
                  promoterEventList.sort((a, b) => b.revenue - a.revenue);
                  
                  doc.addPage();
                  let detailYPos = 20;
                  
                  // Intestazione
                  detailYPos = addSection(`Dettagli Promoter: ${promoter.name || promoter.email || 'Senza nome'}`, detailYPos, [231, 76, 60]); // Rosso
                  
                  // Info promoter
                  doc.setFontSize(12);
                  doc.text(`Email: ${promoter.email || 'N/A'}`, 15, detailYPos);
                  detailYPos += 7;
                  doc.text(`Totale Biglietti: ${promoterTotalTickets}`, 15, detailYPos);
                  detailYPos += 7;
                  doc.text(`Totale Ricavi: €${promoterTotalRevenue.toFixed(2)}`, 15, detailYPos);
                  detailYPos += 7;
                  doc.text(`Totale Eventi: ${promoterEventList.length}`, 15, detailYPos);
                  detailYPos += 15;
                  
                  // Tabella eventi del promoter
                  const promoterEventHead = [['Evento', 'Biglietti', 'Ricavo', '% del Promoter']];
                  const promoterEventRows = promoterEventList.map(event => [
                    event.eventName,
                    event.tickets.toString(),
                    `€${event.revenue.toFixed(2)}`,
                    `${promoterTotalRevenue > 0 ? ((event.revenue / promoterTotalRevenue) * 100).toFixed(1) : '0.0'}%`
                  ]);
                  
                  autoTable(doc, {
                    startY: detailYPos,
                    head: promoterEventHead,
                    body: promoterEventRows,
                    theme: 'grid',
                    headStyles: {
                      fillColor: [231, 76, 60], // Rosso
                      textColor: [255, 255, 255],
                      fontStyle: 'bold'
                    },
                    alternateRowStyles: {
                      fillColor: [255, 236, 236] // Rosso chiaro
                    }
                  });
                }
              }

              autoTable(doc, {
                startY: yPosition,
                head: teamLeaderHead,
                body: teamLeaderRows,
                theme: 'grid',
                headStyles: {
                  fillColor: colors.secondary,
                  textColor: [255, 255, 255],
                  fontStyle: 'bold'
                },
                alternateRowStyles: {
                  fillColor: colors.tableBg
                }
              });
            }
          }

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
            }
          });
        }
      }

      // Aggiungi tabella riassuntiva manager alla pagina principale
      doc.setPage(1); // Torna alla prima pagina
      yPosition = checkNewPage(yPosition);

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
        }
      });
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
    doc.save('statistiche_globali.pdf');
    console.log('Report generato con successo');
    return true;
  } catch (error) {
    console.error('Errore nella generazione del report:', error);
    throw error;
  }
} 