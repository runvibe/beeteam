//! Startup reconciliation marks only this installation's interrupted work.
use super::*;
impl LeaderChatService {
    pub async fn recover(&self) -> Result<()> {
        if self.provider.is_none() {
            return Ok(());
        }
        self.recovered.get_or_try_init(||async{
   let mut u=self.store.begin().await?;
   let turns:Vec<_>=u.records.list("leader_chat_turns").into_iter().filter_map(|turn|{
    let owned=turn.reference("bindingId").and_then(|id|u.records.get("agent_session_bindings",id).ok()).is_some_and(|binding|binding.data["installationId"]==self.installation);
    if !owned{return None}
    let unfinished_receipt=turn.data["status"]=="completed"&&turn.reference("sourceDeliveryId").and_then(|id|u.records.get("session_deliveries",id).ok()).is_some_and(|delivery|matches!(delivery.data["state"].as_str(),Some("dispatching"|"acknowledged"|"uncertain")));
    (!crate::dto::leader_chat::terminal(turn.data["status"].as_str().unwrap_or(""))||unfinished_receipt).then_some((turn.id,unfinished_receipt))
   }).collect();
   for (id,unfinished_receipt) in turns {
    if unfinished_receipt {u.records.get_mut("leader_chat_turns",id)?.data["status"]=json!("uncertain");}
    rules::transition(&mut u.records,id,"uncertain",json!({"code":if unfinished_receipt{"delivery_commit_uncertain"}else{"process_restarted"},"message":"Reconcile provider state before sending another turn"}))?;
   }
   u.commit().await?;Ok::<(),Failure>(())
  }).await?;
        Ok(())
    }
}
