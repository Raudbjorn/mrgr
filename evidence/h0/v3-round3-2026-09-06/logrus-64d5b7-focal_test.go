package logrus
import("testing";"bytes";"encoding/json")
func TestH0CallerAndJSON(t *testing.T){
 for _,pretty:=range []bool{false,true}{for _,caller:=range []bool{false,true}{
  name:="compact";if pretty{name="pretty"};if caller{name+="-caller"}else{name+="-no-caller"}
  t.Run(name,func(t *testing.T){
   logger:=New();logger.ReportCaller=caller
   buffer:=&bytes.Buffer{}
   entry:=&Entry{Logger:logger,Caller:"example.handler",Data:Fields{"payload":"retained"},Level:InfoLevel,Message:"hello",Buffer:buffer}
   f:=JSONFormatter{DisableTimestamp:true,PrettyPrint:pretty,FieldMap:FieldMap{FieldKeyFunc:"source"}}
   output,err:=f.Format(entry);if err!=nil{t.Fatal(err)}
   var data map[string]interface{};if err=json.Unmarshal(output,&data);err!=nil{t.Fatal(err)}
   if data["msg"]!="hello"||data["payload"]!="retained"{t.Fatal("lost log fields")}
   got,exists:=data["source"];if exists!=caller||(caller&&got!="example.handler"){t.Fatal("caller contract failed")}
   if bytes.Contains(output,[]byte("\n  "))!=pretty{t.Fatal("pretty-print contract failed")}
   if !bytes.Equal(buffer.Bytes(),output){t.Fatal("entry buffer not used")}
  })
 }}
}
